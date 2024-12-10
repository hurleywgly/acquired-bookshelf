# Contributing to Acquired Bookshelf

Thank you for your interest in contributing to Acquired Bookshelf! This document provides guidelines and workflows for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a welcoming, inclusive, and harassment-free environment for all contributors.

## Getting Started

1. Fork the repository
2. Clone your fork:
```bash
git clone https://github.com/your-username/acquired-bookshelf.git
```
3. Add the upstream remote:
```bash
git remote add upstream https://github.com/original-owner/acquired-bookshelf.git
```

## Development Process

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-fix-name
```

Use prefixes:
- `feature/` for new features
- `fix/` for bug fixes
- `docs/` for documentation changes
- `refactor/` for code refactoring

### 2. Development Standards

#### Code Style

- Use TypeScript for all new code
- Follow existing code formatting patterns
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

#### Component Guidelines

- Place new components in the `components/` directory
- Use functional components with hooks
- Follow the existing file naming convention
- Include TypeScript interfaces for props
- Use TailwindCSS for styling

#### Commit Messages

Follow conventional commits:
```
type(scope): description

[optional body]

[optional footer]
```

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation changes
- style: Code style updates
- refactor: Code refactoring
- test: Adding tests
- chore: Maintenance tasks

Example:
```
feat(booktile): add hover animation for book covers

- Added scale transform on hover
- Implemented smooth transition
- Updated documentation
```

### 3. Testing

Before submitting:
- Test all changes locally
- Ensure responsive design works
- Check console for errors
- Verify horizontal scroll functionality
- Test search and filtering features

### 4. Submit a Pull Request

1. Push your changes:
```bash
git push origin your-branch-name
```

2. Create a Pull Request:
   - Use a clear title
   - Provide a detailed description
   - Link related issues
   - Include screenshots for UI changes

3. Pull Request Template:
```markdown
## Description
[Describe your changes]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Checklist
- [ ] Tested in development environment
- [ ] No console errors
- [ ] Updated documentation
- [ ] Responsive design verified
```

### 5. Review Process

- Address reviewer feedback promptly
- Keep discussions focused and professional
- Update your branch as needed
- Squash commits before merging

## Book Data Contributions

When adding new books:

1. Verify book information:
   - Correct Amazon URL
   - Accurate episode reference
   - Valid Open Library API data

2. Update `manual-covers.json` if needed:
   - Only for books missing Open Library covers
   - Include high-quality cover image
   - Document the source

## Questions?

If you have questions:
1. Check existing issues
2. Review documentation
3. Create a new issue with the "question" label

## Recognition

All contributors will be recognized in the project's README.md file.