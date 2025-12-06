- use `bun ts` to run typecheck
- use `bun lint` to lint the project
- use `bun format` to format the project. Format after every task is done and project is properly typechecked and linted.

## @llm-script

Files with `@llm-script` comment are meant for LLM scripting. To use:

1. Write code below the `// @llm-script` marker
2. Run `bun ts` to type-check
3. Run the file with `bun <filepath>`

For unknown APIs, check types locally first (don't web search):

- Read `.d.ts` files in `node_modules/<package>/`
- Use `bun ts` errors to guide correct usage
- Iterate: write code → type-check → fix → repeat
