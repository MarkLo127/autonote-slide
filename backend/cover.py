from docx import Document


class cover:
    def __init__(self, filepath):
        self.filepath = filepath
        self.document = Document(filepath)

    def get_cover_text(self):
        cover_text = []
        for paragraph in self.document.paragraphs:
            if paragraph.text.strip():  # Check if the paragraph is not empty
                cover_text.append(paragraph.text.strip())
        return "\n".join(cover_text)