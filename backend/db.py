import os
import re
import pyodbc

SQLSERVER_DRIVER = os.getenv("SQLSERVER_DRIVER", "ODBC Driver 18 for SQL Server")
SQLSERVER_HOST = os.getenv("SQLSERVER_HOST", r"localhost\SQLEXPRESS25")
SQLSERVER_DB = os.getenv("SQLSERVER_DB", "SpaceXBiometricDB")
SQLSERVER_USER = os.getenv("SQLSERVER_USER", "")
SQLSERVER_PASSWORD = os.getenv("SQLSERVER_PASSWORD", "")

if not re.fullmatch(r"[A-Za-z0-9_]+", SQLSERVER_DB):
    raise ValueError(f"Invalid SQLSERVER_DB identifier: {SQLSERVER_DB}")


def build_conn_str(database: str) -> str:
    base = (
        f"DRIVER={{{SQLSERVER_DRIVER}}};"
        f"SERVER={SQLSERVER_HOST};"
        f"DATABASE={database};"
        "TrustServerCertificate=yes;"
    )
    if SQLSERVER_USER and SQLSERVER_PASSWORD:
        return f"{base}UID={SQLSERVER_USER};PWD={SQLSERVER_PASSWORD};"
    return f"{base}Trusted_Connection=yes;"


def get_connection(database: str | None = None) -> pyodbc.Connection:
    return pyodbc.connect(build_conn_str(database or SQLSERVER_DB), autocommit=False)


def init_database() -> None:
    """Creates SpaceXBiometricDB and required tables idempotently on SQL Server."""
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
        conn.commit()
        cur.close()
    finally:
        conn.close()
