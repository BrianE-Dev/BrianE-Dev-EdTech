# BrianE-Dev Documentation

## Project overview

BrianE-Dev is planned as a learning platform for software engineers and technical leaders who want to improve their use of agentic workflows and AI-assisted programming. The supplied design direction combines technical minimalism, terminal and IDE visual language, and focused instructional reading spaces.

The repository currently contains a React 19 and Vite application scaffold. The product screens described in the design notes have not yet been implemented in `src/App.jsx`; it still renders the default Vite starter interface and counter. Treat screen descriptions and design tokens below as the intended product/design specification, not as a claim about current runtime functionality.

## Design concepts supplied

The `UI From Stitch` folder contains design briefs and screen references for:

- **Homepage** (`homepage DESIGN.md` and `homepage-mobile screen DESIGN.md`): the product landing and entry point, with desktop and mobile layouts.
- **Courses** (`courses DESIGN.md`): a course discovery or course selection screen.
- **Curriculum** (`curriculum DESIGN.md`): a structured learning path and lesson navigation view.
- **Learning platform** (`leaning platform - mobile screenDESIGN.md`): a mobile learning experience focused on lesson content and learning tools.
- **Super admin** (`super admin DESIGN.md`): an administrative view for platform management.
- **Syntactic Elevation** (`syntactic elevation.md`): the shared brand, design system, component, and responsive layout specification.

PNG screen references are stored alongside the briefs. The descriptions establish an intended visual language and component behavior; detailed product workflows, permissions, backend behavior, and data models are not specified in the supplied files.

## Brand and visual direction

The intended interface is a high-density, authoritative workspace for technical learning. It should feel precise, fast, and engineered, drawing on command surfaces, modern IDEs, and telemetry dashboards while leaving long-form lessons easy to read. Avoid decorative clutter and consumer-app styling. Use cyan, emerald, and amber as functional accents for focus, success, and warning or milestone states.

### Color palette

The design notes include both a named Syntactic Elevation token palette and more detailed implementation color guidance. For component examples and surface tiers, the detailed values below are the clearest guidance; preserve the semantic roles if the palette is reconciled during implementation.

| Role | Color | Intended use |
| --- | --- | --- |
| Canvas | `#070b12` | Root page background |
| Workspace shell | `#090d16` | Ambient shells, inputs, and reading surfaces |
| Primary panel | `#0f172a` | Lesson modules, cards, code chrome |
| Elevated surface | `#1e293b` | Dialogs, popovers, hover states |
| Primary accent | `#06b6d4` | Focus, active navigation, tabs, telemetry, execution traces |
| Success accent | `#10b981` | Passing assertions and completed modules |
| Warning accent | `#f59e0b` | Warnings, challenge milestones, runtime alerts |
| Structural divider | `#334155` | Borders and grid lines, usually with reduced opacity |

The token header in the supplied design files additionally names a deep blue surface family (`#0b1326`, `#131b2e`, `#171f33`, `#222a3d`, `#2d3449`) and a brighter cyan token (`#4cd7f6`). These values can be used where the tokenized Syntactic Elevation palette is preferred.

### Typography

- Use **Geist** for display and headline text, **Inter** for prose and interface text, and **JetBrains Mono** for code and technical labels.
- Long-form instructional prose uses a generous line height around `1.75` and a readable measure of approximately 68–75 characters.
- Use uppercase monospace labels for telemetry, lesson timestamps, statuses, and diff summaries.
- Inline and block code should have explicit line heights and clear distinction from prose.
- Key type sizes from the token specification: hero `3.5rem` desktop / `2.25rem` mobile; headline XL `2.25rem` / `1.75rem`; body large `1.125rem`; body medium `0.9375rem`; body small `0.8125rem`.

### Layout and responsive behavior

- **Desktop (1280px and wider):** Use a 12-column engineering grid. Navigation may be a 64px rail or a 240px collapsible tree. The lesson reading column occupies about eight columns (up to 768px), with a contextual rail for a code sandbox, terminal output, or outline.
- **Tablet (768–1279px):** Move contextual tools into persistent bottom drawers or segmented panels; reduce gutters to about `1rem`.
- **Mobile (under 768px):** Use a fluid four-column layout, `0.75rem` gutters, and `1rem` outer margins. Code panels may scroll horizontally while keeping line numbers pinned.
- The spacing system is based on 4px increments. Common tokens include `0.125rem`, `0.25rem`, `0.5rem`, `0.75rem`, `1.25rem`, `2rem`, and `3rem`.

### Elevation, shapes, and focus

Prefer surface luminance and fine borders over heavy shadows. The supplied surface tiers are: canvas `#070b12`; base content `#090d16` with a `#1e293b` border; active panels `#0f172a` with a `#334155` border; and overlays `#1e293b` with a cyan-tinted border. Elevated components can use a subtle inset top highlight and restrained ambient shadow. Keyboard focus should be clearly visible with a tight cyan outline or glow.

Use restrained corner radii: `4px` for controls, badges, and code markers; `8px` for lesson containers and split views; `12px` for modal sheets and command palettes. Full rounding is reserved for circular progress indicators, status dots, and avatar heads.

## Component guidance

- **Primary buttons:** Cyan fill (`#06b6d4`), dark foreground, compact padding, and a simple brighter hover state without vertical movement.
- **Secondary buttons:** Dark surface with a slate border; hover by lightening the surface and border.
- **Ghost/tool buttons:** No border; muted text that brightens on hover with a subtle background.
- **Status chips:** Compact uppercase monospace labels. Use emerald for completed, amber for warnings or experimental states, and cyan for AI or architecture labels.
- **Navigation trees:** Show hierarchy with fine vertical guide lines. Mark the active lesson with a 2px cyan left indicator; row hover spans the available width.
- **Checkboxes and radios:** 14px controls. Unchecked controls use a slate outline on a dark surface; checked controls use cyan with a dark glyph.
- **Inputs and command palettes:** Dark shell, slate border, light text, and a cyan border on focus. Prefix symbols such as `>` or `$` may use muted monospace styling.
- **Code panels:** Use a distinct header for tabs, runtime state, and copy actions. Keep the code body near the canvas color, with subdued line numbers and a translucent cyan selection.
- **Inline text-to-speech player:** Place below a lesson title or persist it near the viewport bottom. Use a 2px scrub track and speed controls for `1x`, `1.25x`, `1.5x`, and `2x`.
- **Progress meters:** Use thin (2–4px) tracks, slate backgrounds, emerald completion, and segmented milestones where useful.

## Current application setup

### Requirements

- Node.js and npm compatible with the installed Vite version.
- Install dependencies from the project root with `npm install`.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite development server with hot module replacement. |
| `npm run build` | Create a production build in `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint over the project. |

### Project structure

```text
.
├── public/                 # Static public assets
├── src/
│   ├── assets/             # Imported images and starter assets
│   ├── App.jsx             # Current root React component (Vite starter)
│   ├── App.css             # Starter component styles
│   ├── index.css           # Global styles and theme variables
│   └── main.jsx            # React application entry point
├── UI From Stitch/         # Supplied design briefs and image references
├── index.html              # HTML shell and page title
├── package.json            # Scripts and dependencies
└── vite.config.js          # Vite configuration
```

The current direct dependencies are React and React DOM. Development tooling includes Vite, the React Vite plugin, and ESLint. There is no application backend, database, authentication, routing, or external API configuration documented in the current source tree.

## Implementation notes

- Start implementation from the supplied screen briefs and PNG references in `UI From Stitch/`.
- `src/App.jsx`, `src/App.css`, and `src/index.css` are still starter files and should be replaced or extended as the product screens are built.
- The design notes repeat the shared visual system across multiple screen files; this document consolidates the repeated guidance.
- Some design descriptions mention capabilities such as lesson execution, telemetry, audio playback, quizzes, and administration as visual component concepts. The current source does not implement those capabilities.

## Source documents

- `UI From Stitch/syntactic elevation.md`
- `UI From Stitch/homepage DESIGN.md`
- `UI From Stitch/homepage-mobile screen DESIGN.md`
- `UI From Stitch/courses DESIGN.md`
- `UI From Stitch/curriculum DESIGN.md`
- `UI From Stitch/leaning platform - mobile screenDESIGN.md`
- `UI From Stitch/super admin DESIGN.md`

