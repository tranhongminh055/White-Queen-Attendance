-- SpaceX Biometric Attendance System - SQL Server Schema
-- Target instance: localhost\SQLEXPRESS25

IF DB_ID(N'SpaceXBiometricDB') IS NULL
BEGIN
    CREATE DATABASE [SpaceXBiometricDB];
END
GO

USE [SpaceXBiometricDB];
GO

IF OBJECT_ID(N'dbo.Accounts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Accounts (
        EmployeeId NVARCHAR(32) NOT NULL PRIMARY KEY,
        FullName NVARCHAR(120) NOT NULL,
        Email NVARCHAR(160) NOT NULL UNIQUE,
        Role NVARCHAR(32) NOT NULL DEFAULT N'student',
        ClassId NVARCHAR(40) NOT NULL DEFAULT N'CNTT-K21A',
        PasswordHash NVARCHAR(255) NOT NULL,
        ApprovalStatus NVARCHAR(24) NOT NULL DEFAULT N'approved',
        ApprovalToken NVARCHAR(128) NULL,
        ApprovalExpiresAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

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
GO

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
GO

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
GO

-- Performance Indexes for High-Concurrency Lookups
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_StudentProfiles_ClassId' AND object_id = OBJECT_ID(N'dbo.StudentProfiles'))
    CREATE NONCLUSTERED INDEX IX_StudentProfiles_ClassId ON dbo.StudentProfiles (ClassId) INCLUDE (FullName, Email, EmbeddingCreated);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_FaceEmbeddings_StudentId' AND object_id = OBJECT_ID(N'dbo.FaceEmbeddings'))
    CREATE NONCLUSTERED INDEX IX_FaceEmbeddings_StudentId ON dbo.FaceEmbeddings (StudentId, Id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AttendanceLogs_Class_Created' AND object_id = OBJECT_ID(N'dbo.AttendanceLogs'))
    CREATE NONCLUSTERED INDEX IX_AttendanceLogs_Class_Created ON dbo.AttendanceLogs (ClassId, CreatedAt DESC);
GO

