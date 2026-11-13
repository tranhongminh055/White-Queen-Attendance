import hashlib
import hmac
import secrets


def hash_password(password: str, iterations: int = 120_000) -> str:
    """Hashes a plaintext password with salted PBKDF2-HMAC-SHA256."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations)
    return f"pbkdf2_sha256${iterations}${salt}${dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verifies a plaintext password against a stored PBKDF2-HMAC-SHA256 hash."""
    try:
        scheme, iter_str, salt, expected_hex = stored_hash.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        iterations = int(iter_str)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations)
        return hmac.compare_digest(dk.hex(), expected_hex)
    except Exception:
        return False

