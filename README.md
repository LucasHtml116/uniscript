# 🚀 Uniscript Reference Guide v1.0

**Uniscript** is a meta-compiler designed to orchestrate multiple web technologies (HTML, CSS, JS, TS, PY) into a single, cohesive execution environment. It uses a "Block-to-DOM" injection system to ensure dependencies across different languages are correctly resolved.

---

## 🏗️ File Structure

Every Uniscript program must be wrapped within the start and end tags:

```uniscript
<!uniscript start!>

# Global comments use hashtags #

<!uniscript main, uniscript, content = <
    config title = "App Name"
    config execution = {
        start: "html_block_name",
        then: "css_block_name",
        end: "js_block_name"
    }
>>;

<!uniscript end!>
```

# 📦 The Block System
Each piece of functionality lives in a specific envelope using the syntax:
`<!uniscript name, language, content = < ... >>;`
## Supported Engines
* uniscript
* python
* javascript
* typescript
* css
* html

# ⚙️ Metadata Configurations (Main Block)
Inside the main block (type uniscript), you control the compiler's behavior:

* config execution: Defines the chronological order of DOM injection (`start`, `then`, `end`).
* config target: Sets the container layout (e.g., `"mobile"` for a 360x640px frame or `"computer"` for full screen).
* declare: Creates global variables on the `window` object, accessible by all languages.
* use ... on: Forces a block to be injected specifically into the `"head"` or `"body"`.
