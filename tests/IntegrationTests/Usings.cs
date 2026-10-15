global using NUnit.Framework;
// Fixtures run side by side: each has its own application and its own database (see TestDatabase),
// tests inside a fixture still run one after another. NUnit takes as many workers as there are cores.
[assembly: Parallelizable(ParallelScope.Fixtures)]
