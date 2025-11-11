"""
Git integration for version control of ERD diagrams
"""

import os
from git import Repo, Git
from typing import List, Dict, Optional
from datetime import datetime
from ..models.diagram import Diagram


class GitIntegration:
    """Git integration for diagrams"""

    def __init__(self, repo_path: str):
        """
        Initialize Git integration.

        Args:
            repo_path: Path to Git repository
        """
        self.repo_path = repo_path
        self.repo = None

    def init_repository(self) -> bool:
        """
        Initialize a new Git repository.

        Returns:
            True if successful
        """
        try:
            if not os.path.exists(self.repo_path):
                os.makedirs(self.repo_path)

            if not os.path.exists(os.path.join(self.repo_path, '.git')):
                self.repo = Repo.init(self.repo_path)

                # Create .gitignore
                gitignore_path = os.path.join(self.repo_path, '.gitignore')
                with open(gitignore_path, 'w') as f:
                    f.write("__pycache__/\n*.pyc\n.DS_Store\nvenv/\n")

                return True
            else:
                self.repo = Repo(self.repo_path)
                return True

        except Exception as e:
            print(f"Error initializing repository: {e}")
            return False

    def connect_repository(self) -> bool:
        """
        Connect to existing repository.

        Returns:
            True if successful
        """
        try:
            if os.path.exists(os.path.join(self.repo_path, '.git')):
                self.repo = Repo(self.repo_path)
                return True
            return False
        except Exception as e:
            print(f"Error connecting to repository: {e}")
            return False

    def commit_diagram(self, diagram_file_path: str, message: str, author_name: str = "ERD User", author_email: str = "user@example.com") -> Optional[str]:
        """
        Commit diagram changes.

        Args:
            diagram_file_path: Path to diagram JSON file
            message: Commit message
            author_name: Author name
            author_email: Author email

        Returns:
            Commit hash or None if failed
        """
        try:
            if not self.repo:
                if not self.connect_repository():
                    self.init_repository()

            # Get relative path
            rel_path = os.path.relpath(diagram_file_path, self.repo_path)

            # Add file
            self.repo.index.add([rel_path])

            # Commit
            commit = self.repo.index.commit(
                message,
                author=f"{author_name} <{author_email}>",
                committer=f"{author_name} <{author_email}>"
            )

            return commit.hexsha

        except Exception as e:
            print(f"Error committing diagram: {e}")
            return None

    def get_commit_history(self, diagram_file_path: str, max_count: int = 50) -> List[Dict]:
        """
        Get commit history for a diagram.

        Args:
            diagram_file_path: Path to diagram file
            max_count: Maximum number of commits to return

        Returns:
            List of commit information
        """
        try:
            if not self.repo:
                if not self.connect_repository():
                    return []

            rel_path = os.path.relpath(diagram_file_path, self.repo_path)

            commits = []
            for commit in self.repo.iter_commits(paths=rel_path, max_count=max_count):
                commits.append({
                    'hash': commit.hexsha,
                    'short_hash': commit.hexsha[:7],
                    'message': commit.message.strip(),
                    'author': str(commit.author),
                    'date': datetime.fromtimestamp(commit.committed_date).isoformat(),
                    'timestamp': commit.committed_date
                })

            return commits

        except Exception as e:
            print(f"Error getting commit history: {e}")
            return []

    def checkout_version(self, diagram_file_path: str, commit_hash: str, output_path: str) -> bool:
        """
        Checkout a specific version of a diagram.

        Args:
            diagram_file_path: Path to diagram file
            commit_hash: Commit hash to checkout
            output_path: Where to save the checked out version

        Returns:
            True if successful
        """
        try:
            if not self.repo:
                if not self.connect_repository():
                    return False

            rel_path = os.path.relpath(diagram_file_path, self.repo_path)

            # Get file content at specific commit
            commit = self.repo.commit(commit_hash)
            file_content = (commit.tree / rel_path).data_stream.read()

            # Write to output path
            with open(output_path, 'wb') as f:
                f.write(file_content)

            return True

        except Exception as e:
            print(f"Error checking out version: {e}")
            return False

    def diff_versions(self, diagram_file_path: str, commit_hash1: str, commit_hash2: str = 'HEAD') -> Optional[str]:
        """
        Get diff between two versions.

        Args:
            diagram_file_path: Path to diagram file
            commit_hash1: First commit hash
            commit_hash2: Second commit hash (default: HEAD)

        Returns:
            Diff string or None
        """
        try:
            if not self.repo:
                if not self.connect_repository():
                    return None

            rel_path = os.path.relpath(diagram_file_path, self.repo_path)

            # Get commits
            commit1 = self.repo.commit(commit_hash1)
            commit2 = self.repo.commit(commit_hash2)

            # Get diff
            diff = commit1.diff(commit2, paths=rel_path, create_patch=True)

            if diff:
                return str(diff[0])
            return None

        except Exception as e:
            print(f"Error getting diff: {e}")
            return None

    def create_branch(self, branch_name: str) -> bool:
        """
        Create a new branch.

        Args:
            branch_name: Name of the new branch

        Returns:
            True if successful
        """
        try:
            if not self.repo:
                if not self.connect_repository():
                    return False

            new_branch = self.repo.create_head(branch_name)
            return True

        except Exception as e:
            print(f"Error creating branch: {e}")
            return False

    def switch_branch(self, branch_name: str) -> bool:
        """
        Switch to a different branch.

        Args:
            branch_name: Name of branch to switch to

        Returns:
            True if successful
        """
        try:
            if not self.repo:
                if not self.connect_repository():
                    return False

            self.repo.heads[branch_name].checkout()
            return True

        except Exception as e:
            print(f"Error switching branch: {e}")
            return False

    def list_branches(self) -> List[str]:
        """
        List all branches.

        Returns:
            List of branch names
        """
        try:
            if not self.repo:
                if not self.connect_repository():
                    return []

            return [head.name for head in self.repo.heads]

        except Exception as e:
            print(f"Error listing branches: {e}")
            return []

    def get_current_branch(self) -> Optional[str]:
        """
        Get current branch name.

        Returns:
            Branch name or None
        """
        try:
            if not self.repo:
                if not self.connect_repository():
                    return None

            return self.repo.active_branch.name

        except Exception as e:
            print(f"Error getting current branch: {e}")
            return None

    def push_to_remote(self, remote_name: str = 'origin', branch_name: Optional[str] = None) -> bool:
        """
        Push commits to remote repository.

        Args:
            remote_name: Name of remote
            branch_name: Branch to push (default: current branch)

        Returns:
            True if successful
        """
        try:
            if not self.repo:
                if not self.connect_repository():
                    return False

            if not branch_name:
                branch_name = self.repo.active_branch.name

            origin = self.repo.remote(name=remote_name)
            origin.push(branch_name)
            return True

        except Exception as e:
            print(f"Error pushing to remote: {e}")
            return False

    def pull_from_remote(self, remote_name: str = 'origin', branch_name: Optional[str] = None) -> bool:
        """
        Pull commits from remote repository.

        Args:
            remote_name: Name of remote
            branch_name: Branch to pull (default: current branch)

        Returns:
            True if successful
        """
        try:
            if not self.repo:
                if not self.connect_repository():
                    return False

            if not branch_name:
                branch_name = self.repo.active_branch.name

            origin = self.repo.remote(name=remote_name)
            origin.pull(branch_name)
            return True

        except Exception as e:
            print(f"Error pulling from remote: {e}")
            return False

    def add_remote(self, remote_name: str, remote_url: str) -> bool:
        """
        Add a remote repository.

        Args:
            remote_name: Name for the remote
            remote_url: URL of remote repository

        Returns:
            True if successful
        """
        try:
            if not self.repo:
                if not self.connect_repository():
                    self.init_repository()

            self.repo.create_remote(remote_name, remote_url)
            return True

        except Exception as e:
            print(f"Error adding remote: {e}")
            return False

    def get_status(self) -> Dict:
        """
        Get repository status.

        Returns:
            Status information
        """
        try:
            if not self.repo:
                if not self.connect_repository():
                    return {}

            return {
                'branch': self.repo.active_branch.name,
                'untracked': [item.a_path for item in self.repo.untracked_files],
                'modified': [item.a_path for item in self.repo.index.diff(None)],
                'staged': [item.a_path for item in self.repo.index.diff('HEAD')],
            }

        except Exception as e:
            print(f"Error getting status: {e}")
            return {}
