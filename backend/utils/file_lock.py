"""
File locking utility for concurrent access control
Cross-platform support using portalocker (Windows, Mac, Linux)
"""

import os
import time
from contextlib import contextmanager
from typing import Optional
import portalocker


class FileLock:
    """
    Cross-platform file locking mechanism.
    Uses portalocker which automatically handles platform differences:
    - Windows: Uses msvcrt
    - Unix/Linux/Mac: Uses fcntl
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
        self.lock_file_handle: Optional[object] = None
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
                self.lock_file_handle = open(self.lock_file, 'w')

                # Try to acquire exclusive lock (non-blocking)
                portalocker.lock(
                    self.lock_file_handle,
                    portalocker.LOCK_EX | portalocker.LOCK_NB
                )

                # Write PID to lock file
                self.lock_file_handle.write(str(os.getpid()))
                self.lock_file_handle.flush()

                return True

            except portalocker.exceptions.LockException:
                # Lock is held by another process
                # Close file handle if opened
                if self.lock_file_handle is not None:
                    try:
                        self.lock_file_handle.close()
                    except:
                        pass
                    self.lock_file_handle = None

                # Check timeout
                if (time.time() - start_time) >= self.timeout:
                    return False

                # Wait and retry
                time.sleep(self.delay)

            except Exception as e:
                # Unexpected error
                if self.lock_file_handle is not None:
                    try:
                        self.lock_file_handle.close()
                    except:
                        pass
                    self.lock_file_handle = None
                raise

    def release(self):
        """Release the file lock."""
        if self.lock_file_handle is not None:
            try:
                # Unlock and close file
                portalocker.unlock(self.lock_file_handle)
                self.lock_file_handle.close()
                self.lock_file_handle = None

                # Remove lock file
                try:
                    os.remove(self.lock_file)
                except OSError:
                    pass  # Ignore if already removed

            except Exception as e:
                # Ensure file handle is closed
                if self.lock_file_handle is not None:
                    try:
                        self.lock_file_handle.close()
                    except:
                        pass
                    self.lock_file_handle = None
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
        if self.lock_file_handle is not None:
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
