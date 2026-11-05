import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { useEffect } from "react";

export function TiptapView({ content }: { content: any }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ HTMLAttributes: { class: "rounded-lg my-4 max-w-full" } }),
      Link.configure({ HTMLAttributes: { class: "text-shop-accent underline" } }),
    ],
    content: content || "",
    editable: false,
    editorProps: {
      attributes: {
        class: "prose prose-lg max-w-none focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (editor && content) editor.commands.setContent(content);
  }, [content, editor]);

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}
