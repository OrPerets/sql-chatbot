# Comment Bank Cleanup Script

This script extracts the `commentBank` collection from MongoDB and removes duplicate comments while preserving usage statistics.

## What it does

1. **Creates a backup** of the entire commentBank collection
2. **Identifies duplicates** based on:
   - `questionId` (same question)
   - `feedback` (same comment text)
   - `score` (same score given)
3. **Merges duplicates** by:
   - Keeping the comment with highest `usageCount`
   - If usage count is tied, keeps the most recent one
   - Combines usage counts from all duplicates
4. **Removes duplicate entries** from the database
5. **Generates a detailed report** of the cleanup

## Files created

- `cleanup_comment_bank.js` - Main cleanup script
- `package_cleanup.json` - Dependencies for the script

## How to run

### Prerequisites

Make sure you have:
- Node.js installed
- Access to the MongoDB database
- Proper environment variables set

### Step 1: Install dependencies

```bash
# Copy the package.json
cp package_cleanup.json package.json

# Install dependencies
npm install
```

### Step 2: Set environment variables

```bash
# Set your MongoDB connection string
export MONGODB_URI="mongodb://your-connection-string"

# Or add it to a .env file
echo "MONGODB_URI=mongodb://your-connection-string" > .env
```

### Step 3: Run the cleanup

```bash
# Run the cleanup script
node cleanup_comment_bank.js
```

## What happens during cleanup

```
🚀 Starting Comment Bank Cleanup...

✅ Connected to database
🔄 Creating backup of commentBank collection...
✅ Backup created: commentBank_backup_2024-01-15.json (1,247 comments)
🔍 Analyzing duplicates...
📊 Found 23 duplicate groups with 156 extra comments
🧹 Removing duplicates...
  ✓ Question 1: Kept 1, removed 7 duplicates
  ✓ Question 3: Kept 1, removed 4 duplicates
  ...
✅ Cleanup complete: Removed 156 duplicate comments
📈 Merged usage count: +89 total usages preserved

📊 CLEANUP SUMMARY:
   Original comments: 1,247
   Final comments: 1,091
   Removed duplicates: 156
   Reduction: 12.5%
   Report saved: comment_bank_cleanup_report_2024-01-15.json
```

## Files generated

After running the script, you'll get:

1. **`commentBank_backup_YYYY-MM-DD.json`** - Complete backup of original data
2. **`comment_bank_cleanup_report_YYYY-MM-DD.json`** - Detailed cleanup report with statistics

## Safety features

- ✅ **Full backup** created before any changes
- ✅ **Preserves usage statistics** by merging usage counts
- ✅ **Keeps the most valuable comment** (highest usage or most recent)
- ✅ **Detailed reporting** of all changes made
- ✅ **Non-destructive** - original data is backed up

## What gets preserved

When merging duplicates, the script preserves:
- The comment with the **highest usage count**
- If tied, the **most recently created** comment
- **Combined usage statistics** from all duplicates
- All original metadata (questionText, difficulty, etc.)

## Reverting changes

If you need to restore the original data:

```bash
# Use MongoDB to restore from backup
mongoimport --db mentor --collection commentBank --file commentBank_backup_YYYY-MM-DD.json --jsonArray --drop
```

## Script details

The deduplication logic groups comments by:
```javascript
const key = `${questionId}_${score}_${feedback}`;
```

This means comments are considered duplicates if they have:
- Same question ID
- Same score
- Same feedback text

This is the exact scenario that was happening with the auto-save bug that was fixed. 