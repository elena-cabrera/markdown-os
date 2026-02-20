import { Extension } from "@tiptap/core";
import { Plugin, TextSelection } from "@tiptap/pm/state";

function firstImageFile(files) {
  if (!files || files.length === 0) {
    return null;
  }
  for (const file of Array.from(files)) {
    if (file.type.startsWith("image/")) {
      return file;
    }
  }
  return null;
}

export const UploadImage = Extension.create({
  name: "uploadImage",

  addOptions() {
    return {
      onUpload: null,
      onUploadStart: null,
      onUploadEnd: null,
    };
  },

  addProseMirrorPlugins() {
    const extensionThis = this;

    async function uploadAndInsert(editor, file, selectionPos = null) {
      if (!file || typeof extensionThis.options.onUpload !== "function") {
        return false;
      }

      extensionThis.options.onUploadStart?.();

      try {
        const imagePath = await extensionThis.options.onUpload(file);
        if (!imagePath) {
          return false;
        }

        if (typeof selectionPos === "number") {
          const transaction = editor.state.tr.setSelection(
            TextSelection.create(editor.state.doc, selectionPos),
          );
          editor.view.dispatch(transaction);
        }

        editor
          .chain()
          .focus()
          .setImage({
            src: imagePath,
            alt: file.name || "image",
          })
          .run();
        return true;
      } finally {
        extensionThis.options.onUploadEnd?.();
      }
    }

    return [
      new Plugin({
        props: {
          handlePaste(view, event) {
            const file = firstImageFile(event.clipboardData?.files);
            if (!file) {
              return false;
            }
            event.preventDefault();
            uploadAndInsert(view.editor, file);
            return true;
          },
          handleDrop(view, event) {
            const file = firstImageFile(event.dataTransfer?.files);
            if (!file) {
              return false;
            }

            event.preventDefault();
            const position = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            uploadAndInsert(view.editor, file, position?.pos ?? null);
            return true;
          },
        },
      }),
    ];
  },
});
