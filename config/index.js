module.exports = {
    port: 8000,
    host: '127.0.0.1',
    rootPath: process.cwd(),
    compressExts: ["html", "js", "css", "json", "md", "txt", "xml"],
    cache: {
        maxAge: 2000,
        expires: true,
        cacheControl: true,
        lastModified: true,
        etag: true
    }
}