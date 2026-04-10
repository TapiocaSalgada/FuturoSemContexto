# Commenting and Code Organization

This project avoids noisy comments and prefers comments that explain intent and non-obvious behavior.

## Comment rules

- Add comments for:
  - Cross-browser workarounds
  - Source fallback logic
  - Security constraints
  - Performance-sensitive behavior
  - Business rules that are not obvious from naming
- Do not add comments that only restate obvious code.

## File-level organization

When touching large files, keep this order:

1. Imports
2. Types
3. Constants
4. Utility helpers
5. Main component/handler
6. Side effects/hooks
7. Event handlers
8. Render block / response

## Naming patterns used here

- `loadX`: fetch and hydrate state
- `handleX`: event handler
- `setX`: React state setter
- `normalizeX`: defensive validation
- `resolveX`: runtime decision based on context

## Examples in this repo

- `src/app/watch/[id]/page.tsx` - complex watch state machine
- `src/app/api/watch/[id]/route.ts` - source resolution pipeline
- `src/app/admin/page.tsx` - large admin control surface
