param(
    [string]$Server = "localhost\SQLEXPRESS25",
    [string]$Database = "SpaceXBiometricDB",
    [string]$BackupDir = "G:\White Queen\backups"
)

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$bakPath = Join-Path $BackupDir "$Database`_$timestamp.bak"

Write-Host "Backing up [$Database] on [$Server] to [$bakPath]..."
sqlcmd -S $Server -E -C -b -Q "BACKUP DATABASE [$Database] TO DISK = N'$bakPath' WITH INIT, STATS = 10;"
if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup succeeded: $bakPath"
} else {
    Write-Error "Backup failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

