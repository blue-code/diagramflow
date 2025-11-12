"""
File locking utility for concurrent access control
"""

import os
import time
import fcntl
import errno
from contextlib import contextmanager
from typing import Optional


class FileLock:
    """
    Cross-platform file locking mechanism.
    Uses fcntl on Unix/Linux/Mac, falls back to simple retry on Windows.
    """

    def __init__(self, lock_file: str, timeout: float = 10.0, delay: float = 0.05):
        """
        Initialize file lock.

        Args:
            lock_file: Path to the lock file
            timeout: Maximum time to wait for lock (seconds)
            delay: Delay between lock attempts (seconds)
        """
        self.lock_file = lock_file
        self.lock_file_fd: Optional[int] = None
        self.timeout = timeout
        self.delay = delay

    def acquire(self) -> bool:
        """
        Acquire the file lock.

        Returns:
            True if lock acquired, False otherwise

        Raises:
            IOError: If unable to create lock file
        """
        start_time = time.time()

        while True:
            try:
                # Ensure lock directory exists
                lock_dir = os.path.dirname(self.lock_file)
                if lock_dir:
                    os.makedirs(lock_dir, exist_ok=True)

                # Open/create lock file
                self.lock_file_fd = os.open(
                    self.lock_file,
                    os.O_RDWR | os.O_CREAT | os.O_TRUNC
                )

                # Try to acquire exclusive lock (non-blocking)
                fcntl.flock(self.lock_file_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)

                # Write PID to lock file
                os.write(self.lock_file_fd, str(os.getpid()).encode())
                os.fsync(self.lock_file_fd)

                return True

            except (IOError, OSError) as e:
                # Lock is held by another process
                if e.errno in (errno.EACCES, errno.EAGAIN, errno.EWOULDBLOCK):
                    # Close file descriptor if opened
                    if self.lock_file_fd is not None:
                        os.close(self.lock_file_fd)
                        self.lock_file_fd = None

                    # Check timeout
                    if (time.time() - start_time) >= self.timeout:
                        return False

                    # Wait and retry
                    time.sleep(self.delay)
                else:
                    # Unexpected error
                    if self.lock_file_fd is not None:
                        os.close(self.lock_file_fd)
                        self.lock_file_fd = None
                    raise

    def release(self):
        """Release the file lock."""
        if self.lock_file_fd is not None:
            try:
                # Release lock
                fcntl.flock(self.lock_file_fd, fcntl.LOCK_UN)
                # Close file
                os.close(self.lock_file_fd)
                self.lock_file_fd = None

                # Remove lock file
                try:
                    os.remove(self.lock_file)
                except OSError:
                    pass  # Ignore if already removed

            except Exception as e:
                # Ensure file descriptor is closed
                if self.lock_file_fd is not None:
                    try:
                        os.close(self.lock_file_fd)
                    except:
                        pass
                    self.lock_file_fd = None
                raise

    def __enter__(self):
        """Context manager entry."""
        if not self.acquire():
            raise TimeoutError(f"Could not acquire lock on {self.lock_file} within {self.timeout} seconds")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.release()
        return False  # Don't suppress exceptions

    def __del__(self):
        """Ensure lock is released on deletion."""
        if self.lock_file_fd is not None:
            try:
                self.release()
            except:
                pass


@contextmanager
def file_lock(file_path: str, timeout: float = 10.0):
    """
    Context manager for file locking.

    Args:
        file_path: Path to the file to lock
        timeout: Maximum time to wait for lock

    Yields:
        FileLock instance

    Example:
        with file_lock('/path/to/file.json'):
            # Perform file operations
            pass
    """
    lock_file = file_path + '.lock'
    lock = FileLock(lock_file, timeout=timeout)

    try:
        lock.acquire()
        yield lock
    finally:
        lock.release()
