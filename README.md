# Studio

## Installation

```bash
npm install
```

## Development

- **App Dev Server**: Runs on port `5173` (`http://localhost:5173`)

  ```bash
  npm run dev
  ```

- **Storybook**: Runs on port `6006` (`http://localhost:6006`)
  ```bash
  npm run storybook
  ```

## Build

- **Build App**:

  ```bash
  npm run build
  ```

- **Build Storybook**:
  ```bash
  npm run build-storybook
  ```

## Clean

- **Clean Artifacts & Dependencies**:
  ```bash
  npm run clean
  ```

## Agent Guidelines

### 1. Storybook & Component Story Structure

- **Start with a Default Story**: Every component must start with a `Default` story that cleanly binds to the component's props, allowing Storybook's Autodocs and Controls panel to interactively manipulate props out of the box.
- **Minimal, Focused Variants**: Follow the default story with a minimal set of variant stories. Avoid bloated or unnecessary permutations.
- **Avoid Redundant Prop Combinations**:
  - Each story must focus strictly on the feature or state it demonstrates.
  - For example, in a button states story (like disabled or loading states), do not add leading/trailing icons or subtitles if they are irrelevant to demonstrating the state, since layout combinations are already covered elsewhere.
  - Similarly, in a title-with-subtitle story, leave out extraneous icons unless specifically showcasing full anatomy.

### 2. Comment Removal & Clean Code Policy

- **Strip Thinking/Scratch Comments**: After code has been generated, all comments that were part of the thinking process, section dividers, or obvious restatements of code must be removed.
- **Preserve Only Critical Comments**: Only keep essential comments such as `TODO`, `FIXME`, and explanations of non-obvious tricky logic or magic numbers.

### 3. Testing Guidelines

- **No Automatic Interaction Tests**: Do not generate interaction tests (such as Storybook `play` functions or automated interaction suites) during initial component and story code generation.
- **Prompt the User First**: Always ask the user in a follow-up question whether interaction or unit tests should be added.
