# Lightweight image with system tools needed for conversion
FROM python:3.11-slim

# System deps: LibreOffice (for Office→PDF), Pandoc (for MD/TXT→PDF), Graphviz (mind maps)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    pandoc \
    graphviz \
    fonts-noto fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY run.sh ./run.sh

ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["/bin/bash", "run.sh"]
