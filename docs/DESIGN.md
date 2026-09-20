# DocuFlow AI — UI/UX Design Specifications

## 1. Design Philosophy

DocuFlow AI features a dark-mode "Intelligence Studio" aesthetic built with Vanilla CSS. The design focuses on high legibility, smooth micro-animations, glassmorphism card containers, and distinct visual hierarchy.

---

## 2. Color Palette & Visual Tokens

- **Background Shell**: `#0b0f19` (Deep obsidian background)
- **Card / Surface Background**: `rgba(18, 26, 43, 0.7)` with `backdrop-filter: blur(16px)`
- **Accent Primary (Cyan/Blue)**: `#00f2fe` to `#4facfe` gradient
- **Accent Secondary (Mint/Green)**: `#00f5a0` to `#00d9f5` gradient
- **Accent Warning (Amber)**: `#ffb800`
- **Accent Danger (Coral/Red)**: `#ff4b4b`
- **Typography**: System sans-serif stack (`Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`)

---

## 3. UI Component Systems

### 3.1 Stat Cards
Four metric cards display daily brief numbers:
1. **Total Documents**: Accent Blue (`01`)
2. **Pending Actions**: Accent Amber (`02`)
3. **High Priority Risks**: Accent Red (`03`)
4. **Upcoming Deadlines**: Accent Green (`04`)

### 3.2 Action Board & Status Pills
- Custom `StatusSelect` dropdown with animated checkmarks and selection triggers.
- Visual status indicators (`StatusVisual`):
  - **Pending**: Amber ring indicator
  - **In Progress**: Blue pulse animation
  - **Completed**: Green circle with checkmark (`✓`)

### 3.3 Confirmation Dialog
- Backdrop blur overlay with custom animated delete icon and dual confirmation buttons.
