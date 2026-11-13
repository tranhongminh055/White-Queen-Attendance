import os
import queue
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


def _load_local_env() -> None:
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_local_env()


def _normalize_database_url(raw_url: str) -> str:
    url = raw_url.strip()
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://") :]
    return url


DATABASE_URL = _normalize_database_url(os.getenv("DATABASE_URL", ""))
DB_ENGINE = "postgresql" if DATABASE_URL else "sqlserver"

SQLSERVER_DRIVER = os.getenv("SQLSERVER_DRIVER", "ODBC Driver 18 for SQL Server")
SQLSERVER_HOST = os.getenv("SQLSERVER_HOST", r"localhost\SQLEXPRESS25")
SQLSERVER_DB = os.getenv("SQLSERVER_DB", "SpaceXBiometricDB")
SQLSERVER_USER = os.getenv("SQLSERVER_USER", "")
SQLSERVER_PASSWORD = os.getenv("SQLSERVER_PASSWORD", "")
DB_POOL_SIZE = max(2, min(64, int(os.getenv("DB_POOL_SIZE", "8" if DATABASE_URL else "16"))))
DB_CONNECT_TIMEOUT = max(3, min(30, int(os.getenv("DB_CONNECT_TIMEOUT", "10"))))

if not re.fullmatch(r"[A-Za-z0-9_]+", SQLSERVER_DB):
    raise ValueError(f"Invalid SQLSERVER_DB identifier: {SQLSERVER_DB}")


def build_conn_str(database: str) -> str:
    base = (
        f"DRIVER={{{SQLSERVER_DRIVER}}};"
        f"SERVER={SQLSERVER_HOST};"
        f"DATABASE={database};"
        f"Connection Timeout={DB_CONNECT_TIMEOUT};"
        "TrustServerCertificate=yes;"
    )
    if SQLSERVER_USER and SQLSERVER_PASSWORD:
        return f"{base}UID={SQLSERVER_USER};PWD={SQLSERVER_PASSWORD};"
    return f"{base}Trusted_Connection=yes;"


def _qmark_to_pyformat(sql: str) -> str:
    """Convert ODBC '?' placeholders to psycopg '%s' outside SQL string literals."""
    out: list[str] = []
    in_single_quote = False
    i = 0
    n = len(sql)
    while i < n:
        ch = sql[i]
        if ch == "'":
            out.append(ch)
            if in_single_quote and i + 1 < n and sql[i + 1] == "'":
                out.append("'")
                i += 2
                continue
            in_single_quote = not in_single_quote
        elif ch == "%" and not in_single_quote:
            out.append("%%")
        elif ch == "?" and not in_single_quote:
            out.append("%s")
        else:
            out.append(ch)
        i += 1
    return "".join(out)


if DB_ENGINE == "postgresql":
    import psycopg
    from psycopg_pool import ConnectionPool

    IntegrityError: tuple[type[Exception], ...] = (psycopg.IntegrityError,)
    _parsed_pg = urlparse(DATABASE_URL)
    DB_DISPLAY_HOST = _parsed_pg.hostname or "postgresql"
    DB_DISPLAY_NAME = (_parsed_pg.path or "").lstrip("/") or "postgres"

    class PgCursorWrapper:
        """Adapts psycopg cursor to accept '?' parameter placeholders like pyodbc."""

        def __init__(self, raw_cursor: Any):
            self._cur = raw_cursor

        def execute(self, sql: str, params: Any = None):
            pg_sql = _qmark_to_pyformat(sql)
            if params is None:
                return self._cur.execute(pg_sql)
            return self._cur.execute(pg_sql, params)

        def executemany(self, sql: str, seq_of_params: Any):
            pg_sql = _qmark_to_pyformat(sql)
            return self._cur.executemany(pg_sql, seq_of_params)

        def fetchone(self):
            return self._cur.fetchone()

        def fetchall(self):
            return self._cur.fetchall()

        def fetchmany(self, size: int | None = None):
            return self._cur.fetchmany(size)

        def close(self) -> None:
            self._cur.close()

        @property
        def rowcount(self) -> int:
            return self._cur.rowcount

        @property
        def description(self):
            return self._cur.description

        def __iter__(self):
            return iter(self._cur)

    class PgPooledConnection:
        """Wraps a psycopg_pool connection so .close() returns it cleanly to the pool."""

        def __init__(self, raw_conn: Any, pool: ConnectionPool):
            self._raw = raw_conn
            self._pool = pool
            self._broken = False
            self._closed = False

        def cursor(self) -> PgCursorWrapper:
            return PgCursorWrapper(self._raw.cursor())

        def commit(self) -> None:
            self._raw.commit()

        def rollback(self) -> None:
            try:
                self._raw.rollback()
            except Exception:
                self._broken = True

        def mark_broken(self) -> None:
            self._broken = True

        def close(self) -> None:
            if self._closed:
                return
            self._closed = True
            try:
                if not self._broken:
                    self._raw.rollback()
            except Exception:
                self._broken = True
            if self._broken:
                try:
                    self._raw.close()
                except Exception:
                    pass
            self._pool.putconn(self._raw)

    _pg_pool: ConnectionPool | None = None

    def _get_pg_pool() -> ConnectionPool:
        global _pg_pool
        if _pg_pool is None:
            _pg_pool = ConnectionPool(
                conninfo=DATABASE_URL,
                min_size=1,
                max_size=DB_POOL_SIZE,
                timeout=float(DB_CONNECT_TIMEOUT),
                open=True,
                kwargs={"autocommit": False, "connect_timeout": DB_CONNECT_TIMEOUT},
            )
        return _pg_pool

    def get_connection(database: str | None = None) -> PgPooledConnection:
        pool = _get_pg_pool()
        raw_conn = pool.getconn(timeout=float(DB_CONNECT_TIMEOUT))
        return PgPooledConnection(raw_conn, pool)

    def init_database() -> None:
        """Applies PostgreSQL schema and indexes idempotently."""
        schema_path = Path(__file__).resolve().parent / "pg_schema.sql"
        ddl_sql = schema_path.read_text(encoding="utf-8")
        conn = get_connection()
        try:
            # psycopg execute() handles multi-statement SQL scripts when no params are passed
            raw_cur = conn._raw.cursor()
            raw_cur.execute(ddl_sql)
            raw_cur.close()
            conn.commit()
        except Exception:
            conn.mark_broken()
            raise
        finally:
            conn.close()

else:
    import pyodbc

    IntegrityError = (pyodbc.IntegrityError,)
    DB_DISPLAY_HOST = SQLSERVER_HOST
    DB_DISPLAY_NAME = SQLSERVER_DB

    class PooledConnection:
        """Wraps a pyodbc connection so .close() returns it safely to the worker pool."""

        def __init__(self, raw_conn: pyodbc.Connection, pool: "SqlServerPool"):
            self._raw = raw_conn
            self._pool = pool
            self._broken = False
            self._closed = False

        def cursor(self) -> pyodbc.Cursor:
            return self._raw.cursor()

        def commit(self) -> None:
            self._raw.commit()

        def rollback(self) -> None:
            try:
                self._raw.rollback()
            except Exception:
                self._broken = True

        def mark_broken(self) -> None:
            self._broken = True

        def close(self) -> None:
            if self._closed:
                return
            self._closed = True
            self._pool.release(self._raw, broken=self._broken)

    class SqlServerPool:
        """Thread-safe connection pool with stale-handle detection and auto-reconnect."""

        def __init__(self, database: str, maxsize: int):
            self._database = database
            self._pool: queue.LifoQueue[pyodbc.Connection] = queue.LifoQueue(maxsize=maxsize)

        def _open_new(self) -> pyodbc.Connection:
            return pyodbc.connect(build_conn_str(self._database), autocommit=False)

        def _is_alive(self, conn: pyodbc.Connection) -> bool:
            try:
                cur = conn.cursor()
                cur.execute("SELECT 1")
                cur.close()
                return True
            except Exception:
                return False

        def acquire(self) -> PooledConnection:
            while True:
                try:
                    raw = self._pool.get_nowait()
                except queue.Empty:
                    raw = self._open_new()
                    return PooledConnection(raw, self)

                if self._is_alive(raw):
                    return PooledConnection(raw, self)
                try:
                    raw.close()
                except Exception:
                    pass

        def release(self, raw: pyodbc.Connection, broken: bool = False) -> None:
            if broken:
                try:
                    raw.close()
                except Exception:
                    pass
                return

            try:
                raw.rollback()
                self._pool.put_nowait(raw)
            except Exception:
                try:
                    raw.close()
                except Exception:
                    pass

    _app_pool = SqlServerPool(SQLSERVER_DB, DB_POOL_SIZE)

    def get_connection(database: str | None = None):
        if database is None or database == SQLSERVER_DB:
            return _app_pool.acquire()
        return pyodbc.connect(build_conn_str(database), autocommit=False)

    def init_database() -> None:
        """Creates SpaceXBiometricDB, tables, and performance indexes idempotently."""
        master_conn = pyodbc.connect(build_conn_str("master"), autocommit=True)
        try:
            cur = master_conn.cursor()
            cur.execute(f"IF DB_ID(N'{SQLSERVER_DB}') IS NULL CREATE DATABASE [{SQLSERVER_DB}];")
            cur.close()
        finally:
            master_conn.close()

        conn = get_connection(SQLSERVER_DB)
        try:
            cur = conn.cursor()
            cur.execute(
                """
                IF OBJECT_ID(N'dbo.Accounts', N'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.Accounts (
                        EmployeeId NVARCHAR(32) NOT NULL PRIMARY KEY,
                        FullName NVARCHAR(120) NOT NULL,
                        Email NVARCHAR(160) NOT NULL UNIQUE,
                        Role NVARCHAR(32) NOT NULL DEFAULT N'student',
                        ClassId NVARCHAR(40) NOT NULL DEFAULT N'CNTT-K21A',
                        PasswordHash NVARCHAR(255) NOT NULL,
                        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
                    );
                END
                """
            )
            cur.execute(
                """
                IF OBJECT_ID(N'dbo.StudentProfiles', N'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.StudentProfiles (
                        StudentId NVARCHAR(32) NOT NULL PRIMARY KEY,
                        FullName NVARCHAR(120) NOT NULL,
                        ClassId NVARCHAR(40) NOT NULL DEFAULT N'CNTT-K21A',
                        Email NVARCHAR(160) NOT NULL UNIQUE,
                        AvatarDataUrl NVARCHAR(MAX) NULL,
                        EmbeddingCreated BIT NOT NULL DEFAULT 0,
                        RegisteredAt NVARCHAR(64) NULL,
                        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                        CONSTRAINT FK_StudentProfiles_Accounts
                            FOREIGN KEY (StudentId) REFERENCES dbo.Accounts(EmployeeId) ON DELETE CASCADE
                    );
                END
                """
            )
            cur.execute(
                """
                IF OBJECT_ID(N'dbo.FaceEmbeddings', N'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.FaceEmbeddings (
                        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        StudentId NVARCHAR(32) NOT NULL,
                        AngleKey NVARCHAR(24) NOT NULL,
                        DescriptorJson NVARCHAR(MAX) NOT NULL,
                        SnapshotDataUrl NVARCHAR(MAX) NULL,
                        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                        CONSTRAINT UQ_FaceEmbeddings_Student_Angle UNIQUE (StudentId, AngleKey),
                        CONSTRAINT FK_FaceEmbeddings_StudentProfiles
                            FOREIGN KEY (StudentId) REFERENCES dbo.StudentProfiles(StudentId) ON DELETE CASCADE
                    );
                END
                """
            )
            cur.execute(
                """
                IF OBJECT_ID(N'dbo.AttendanceLogs', N'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.AttendanceLogs (
                        Id NVARCHAR(48) NOT NULL PRIMARY KEY,
                        StudentId NVARCHAR(32) NOT NULL,
                        StudentName NVARCHAR(120) NOT NULL,
                        ClassId NVARCHAR(40) NOT NULL,
                        Confidence NVARCHAR(24) NOT NULL,
                        AvatarDataUrl NVARCHAR(MAX) NULL,
                        Device NVARCHAR(120) NOT NULL,
                        ScannedDate DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
                        TimestampText NVARCHAR(64) NOT NULL,
                        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                        CONSTRAINT UQ_AttendanceLogs_Daily UNIQUE (StudentId, ClassId, ScannedDate),
                        CONSTRAINT FK_AttendanceLogs_StudentProfiles
                            FOREIGN KEY (StudentId) REFERENCES dbo.StudentProfiles(StudentId) ON DELETE CASCADE
                    );
                END
                """
            )
            cur.execute(
                """
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_StudentProfiles_ClassId' AND object_id = OBJECT_ID(N'dbo.StudentProfiles'))
                    CREATE NONCLUSTERED INDEX IX_StudentProfiles_ClassId ON dbo.StudentProfiles (ClassId) INCLUDE (FullName, Email, EmbeddingCreated);
                """
            )
            cur.execute(
                """
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_FaceEmbeddings_StudentId' AND object_id = OBJECT_ID(N'dbo.FaceEmbeddings'))
                    CREATE NONCLUSTERED INDEX IX_FaceEmbeddings_StudentId ON dbo.FaceEmbeddings (StudentId, Id);
                """
            )
            cur.execute(
                """
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AttendanceLogs_Class_Created' AND object_id = OBJECT_ID(N'dbo.AttendanceLogs'))
                    CREATE NONCLUSTERED INDEX IX_AttendanceLogs_Class_Created ON dbo.AttendanceLogs (ClassId, CreatedAt DESC);
                """
            )
            conn.commit()
            cur.close()
        finally:
            conn.close()
