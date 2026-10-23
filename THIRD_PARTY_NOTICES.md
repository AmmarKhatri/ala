# Third-party notices

Direct dependencies through P0-04 (licenses from npm package metadata):

| Package            | Version | License           |
| ------------------ | ------- | ----------------- |
| TypeScript         | 6.0.3   | Apache-2.0        |
| Vitest             | 5.0.5   | MIT               |
| @biomejs/biome     | 2.6.2   | MIT OR Apache-2.0 |
| @types/node        | 22.20.5 | MIT               |
| dependency-cruiser | 18.7.0  | MIT               |

Runtime packages:

| Package                   | Version | License |
| ------------------------- | ------- | ------- |
| @modelcontextprotocol/sdk | 1.32.1  | MIT     |
| zod                       | 4.6.7   | MIT     |

The MCP SDK and Zod are runtime dependencies; the remaining packages are development
tools. Packages are installed through npm, not vendored. Their license texts and
transitive dependency notices remain in the installed packages. The lockfile records
the resolved dependency tree and package license metadata where provided.
