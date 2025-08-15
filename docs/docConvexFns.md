### Convex functions in gitrapid

## Models Folder Structure

The `convex/models/` folder follows a table-centric organization pattern:

### Individual Table Files
Each file in `models/` represents operations for a single database table (defined in `schema.ts`) and contains:
- **Table-specific queries and mutations** - Operations that only affect that table
- **Exported functions** - Public API for that table's operations
- **Internal helper methods** - Private methods used within the file

**Example structure:**
```typescript
// models/repos.ts
export const Repos = {
    // Internal methods
    async getByOwnerAndRepo(ctx, owner, repo) { ... },
    
    // Other internal methods...
}

// Exported public API
export const getByOwnerAndRepo = protectedQuery({ ... })
export const deleteById = protectedMutation({ ... })
```

### Cross-Table Operations (`models.ts`)
The `models.ts` file contains operations that affect multiple tables:
- **Complex business logic** requiring data from multiple tables
- **Transaction-like operations** that modify several tables atomically
- **Utility functions** that coordinate between different tables

**Example:**
```typescript
// models/models.ts
export const IssuesUtils = {
    async upsertIssue(ctx, args) {
        // Updates issues table
        // Updates repoCounts table
        // May affect other related tables
    }
}
```

### Key Principles

1. **Schema Definition**: All tables are defined in `schema.ts` with their indexes and relationships
2. **Single Responsibility**: Each table file handles only operations for its corresponding table
3. **Cross-Table Logic**: Complex operations involving multiple tables go in `models.ts`
4. **Consistent API**: All files export protected queries/mutations with similar patterns
5. **Index Usage**: Prefer `.withIndex()` over `.filter()` for performance
6. **Error Handling**: Return errors instead of throwing exceptions

### File Organization

**Schema Definition:**
- `schema.ts` - Defines all database tables, indexes, and relationships
