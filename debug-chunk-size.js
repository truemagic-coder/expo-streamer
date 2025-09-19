// Debug test to understand chunk size calculation
const testData = 'A'.repeat(87500);
const estimatedDecodedSize = (testData.length * 3) / 4;
console.log('Test data length:', testData.length);
console.log('Estimated decoded size:', estimatedDecodedSize);
console.log('64KB limit:', 64 * 1024);
console.log('Exceeds limit:', estimatedDecodedSize > 64 * 1024);