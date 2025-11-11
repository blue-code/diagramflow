# Contributing to DiagramFlow 🌊

Thank you for your interest in contributing to DiagramFlow! We welcome contributions from the community.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/your-org/diagramflow/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Environment details (OS, Python version, browser)

### Suggesting Features

1. Check existing feature requests
2. Create a new issue with tag `enhancement`
3. Describe the feature and its use case
4. Explain why it would benefit DiagramFlow users

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Write/update tests if applicable
5. Update documentation
6. Commit with clear messages (`git commit -m 'Add amazing feature'`)
7. Push to your branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Style

- Follow PEP 8 for Python code
- Use meaningful variable and function names
- Add docstrings to functions and classes
- Keep functions focused and small
- Write comments for complex logic

### Testing

```bash
# Run tests
pytest tests/

# Run with coverage
pytest --cov=backend tests/
```

### Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/diagramflow.git
cd diagramflow

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run development server
python backend/app.py
```

## Areas for Contribution

### High Priority
- 🧪 Test coverage improvements
- 📱 Mobile responsiveness
- 🌍 Internationalization (i18n)
- 🎯 Auto-layout algorithms
- 📚 Documentation improvements

### Good First Issues
Look for issues tagged with `good-first-issue` for beginner-friendly tasks.

## Community Guidelines

- Be respectful and inclusive
- Help others learn and grow
- Provide constructive feedback
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md)

## Questions?

- Open a discussion in [Discussions](https://github.com/your-org/diagramflow/discussions)
- Join our community chat (link coming soon)

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project website (coming soon)

Thank you for making DiagramFlow better! 🎉
