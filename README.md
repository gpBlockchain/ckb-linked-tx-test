Sure, here's the optimized GitHub README for the `ckb-linked-tx` project:

**ckb-linked-tx**

**A tool for testing CKB linked transactions.**


**Installation**

```bash
npm install
```

**Configuration**

The configuration file `config.json` defines the parameters for the testing scenarios. Modify the following values in the file:

```json
{
  "account": "", // Account private key
  "ckbUrl": "https://testnet.ckb.dev", // CKB node URL
  "cellCount": 250, // Total number of cells
  "sendCount": 1000, // Total number of transactions
  "txCountRange": [1, 10], // Range of cells per transaction
  "fee": 1000, // Transaction fee
  "intervalTime": 0 // Interval between transactions (milliseconds)
}
```

**Usage**

1. **Prepare Cells:**
    - Run `npm run split` to generate `config.cellCount` cells.

2. **Test Linked Tx:**
    - Run `npm run demo` to start the testing process.

**Testing Scenarios**

1. **Generate cells:**
    - The tool retrieves `config.cellCount` cells from the specified `config.account`.
    - Each cell is assigned a unique index in ascending order.

2. **Create linked transactions:**
    - For each transaction, the tool randomly selects `n` cells from the available pool within the `txCountRange`.
    - These `n` cells are used to construct a new linked transaction.
    - The new transaction generates `n` new cells with updated indexes.

3. **Repeat and wait:**
    - The tool repeats steps 2 for `config.sendCount` times, introducing a delay of `config.intervalTime` milliseconds between each iteration.
