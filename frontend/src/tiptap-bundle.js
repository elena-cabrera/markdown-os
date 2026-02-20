import { Editor } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { MarkdownOSCodeBlock } from "./extensions/code-block-node.js";
import { UploadImage } from "./extensions/image-node.js";
import {
  insertDisplayMathSyntax,
  insertInlineMathSyntax,
  renderKatexExpression,
} from "./extensions/katex-node.js";
import { closeFullscreenMermaid, rerenderMermaidNodeViews } from "./extensions/mermaid-node.js";

function defaultExtensions(options = {}) {
  return [
    StarterKit.configure({
      codeBlock: false,
    }),
    Markdown.configure({
      html: true,
      tightLists: true,
      tightListClass: "tight",
      bulletListMarker: "-",
      linkify: false,
      breaks: true,
      transformPastedText: true,
      transformCopiedText: true,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
    }),
    Image,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
    MarkdownOSCodeBlock,
    UploadImage.configure({
      onUpload: options.onUploadImage,
      onUploadStart: options.onUploadStart,
      onUploadEnd: options.onUploadEnd,
    }),
  ];
}

function createTipTapEditor(options = {}) {
  return new Editor({
    element: options.element,
    extensions: defaultExtensions(options),
    content: options.content || "",
    contentType: "markdown",
    editable: options.editable !== false,
    autofocus: options.autofocus || false,
    editorProps: {
      attributes: {
        class: "ProseMirror markdown-content",
        "data-testid": "markdown-os-wysiwyg",
      },
    },
    onCreate(context) {
      options.onCreate?.(context);
    },
    onUpdate(context) {
      options.onUpdate?.(context);
    },
    onSelectionUpdate(context) {
      options.onSelectionUpdate?.(context);
    },
    onFocus(context) {
      options.onFocus?.(context);
    },
    onBlur(context) {
      options.onBlur?.(context);
    },
  });
}

function getMarkdown(editor) {
  if (!editor) {
    return "";
  }
  const markdownStorage = editor.storage?.markdown;
  if (markdownStorage && typeof markdownStorage.getMarkdown === "function") {
    return markdownStorage.getMarkdown();
  }
  return "";
}

function setMarkdown(editor, markdown, emitUpdate = true) {
  if (!editor) {
    return;
  }

  const nextContent = markdown || "";
  try {
    editor.commands.setContent(nextContent, {
      contentType: "markdown",
      emitUpdate,
    });
  } catch (_error) {
    editor.commands.setContent(nextContent, emitUpdate);
  }
}

const MarkdownOSTipTap = {
  Editor,
  createTipTapEditor,
  getMarkdown,
  setMarkdown,
  insertInlineMathSyntax,
  insertDisplayMathSyntax,
  renderKatexExpression,
  rerenderMermaidNodeViews,
  closeFullscreenMermaid,
};

window.MarkdownOSTipTap = MarkdownOSTipTap;
