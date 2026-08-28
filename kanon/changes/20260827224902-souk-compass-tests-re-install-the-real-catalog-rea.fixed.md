Souk Compass tests: re-install the real catalog-reader module in afterEach because Bun mock.restore() does not revert mock.module, eliminating the order-dependent module-mock leak that failed CI
