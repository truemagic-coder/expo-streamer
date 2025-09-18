# Contributing to expo-streamer

Thank you for your interest in contributing to expo-streamer! This document outlines the process and guidelines for contributing to this project.

## 🤝 Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please be respectful and constructive in all interactions.

## 🚀 Getting Started

### Prerequisites
- Node.js 18 or higher
- npm or yarn
- iOS development: Xcode 14+, macOS
- Android development: Android Studio, Java 11+

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/yourusername/expo-streamer.git
   cd expo-streamer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the example app**
   ```bash
   cd example
   npm run ios     # or npm run android
   ```

## 🧪 Testing

Before submitting any changes, ensure all tests pass:

```bash
# Run all tests
npm run test:all

# Run individual test suites
npm test                    # TypeScript tests
npm run test:ios           # iOS XCTest suite
npm run test:android       # Android JUnit tests
npm run test:coverage      # Coverage report
```

## 📝 Submission Guidelines

### Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes following our coding standards**

3. **Add tests for new functionality**
   - TypeScript: Jest tests in `__tests__/`
   - iOS: XCTest in `ios/Tests/`
   - Android: JUnit in `android/src/test/`

4. **Run the full test suite**
   ```bash
   npm run test:all
   ```

5. **Commit with descriptive messages**
   ```bash
   git commit -m "feat: add awesome new feature"
   ```

6. **Push and create a pull request**

### Commit Message Format

We use conventional commits:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `test:` Adding tests
- `refactor:` Code refactoring
- `chore:` Build/dependency updates

## 🏗️ Coding Standards

### General Principles
- Follow **SOLID principles**
- Ensure **thread safety** for all operations
- Include **comprehensive error handling**
- No **force unwrapping** (iOS) or **unsafe lateinit** (Android)
- Maintain **high test coverage** (95%+)

### TypeScript
- Use TypeScript strict mode
- Document all public APIs with JSDoc
- Prefer functional programming patterns
- Use proper Result types for error handling

### iOS Swift
- Follow Swift naming conventions
- Use protocol-based dependency injection
- Implement proper error handling with Result types
- Use DispatchQueue for thread synchronization
- No force unwrapping (!) allowed

### Android Kotlin
- Follow Kotlin coding conventions
- Use interface-driven design
- Implement proper coroutine handling
- Use Mutex for thread synchronization
- Avoid lateinit without null safety

## 🐛 Reporting Issues

When reporting issues, please include:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, device, versions)
- Relevant logs or error messages

## 💡 Feature Requests

For feature requests:
- Describe the use case clearly
- Explain why it would benefit the library
- Consider backwards compatibility
- Provide examples if possible

## 📚 Documentation

When adding features:
- Update the README.md if needed
- Add inline code documentation
- Include usage examples
- Update the API reference

## 🔄 Review Process

All submissions go through code review:
- **Functionality**: Does it work as intended?
- **Testing**: Are there comprehensive tests?
- **Architecture**: Does it follow SOLID principles?
- **Safety**: Is it thread-safe and crash-proof?
- **Documentation**: Is it properly documented?

## 🎯 Areas for Contribution

We especially welcome contributions in:
- 🧪 **Testing**: Improving test coverage
- 📱 **Platform Support**: iOS/Android optimizations
- 🎛️ **Audio Features**: New audio processing capabilities
- 📖 **Documentation**: Examples and guides
- 🔧 **Performance**: Optimizations and profiling
- 🐛 **Bug Fixes**: Issue resolution

## 📞 Getting Help

If you need help:
- Check existing [Issues](https://github.com/truemagic-coder/expo-streamer/issues)
- Start a [Discussion](https://github.com/truemagic-coder/expo-streamer/discussions)
- Review the [documentation](https://github.com/truemagic-coder/expo-streamer/wiki)

## 🏆 Recognition

Contributors will be:
- Listed in the project contributors
- Credited in release notes for significant contributions
- Invited to be maintainers for sustained contributions

Thank you for helping make expo-streamer better! 🎙️