const http = require('http')
const configs = require('./config')
const fs = require('fs')
const jade = require('jade')
const { join, extname } = require('path')
const { promisify } = require('util')
const statAsync = promisify(fs.stat)
const readdirAsync = promisify(fs.readdir)
const mameTypeFn = require('./mime')
const etagFn = require('etag')
const { createDeflate, createGzip } = require("zlib")
const { exec } = require("child_process")
module.exports = function server(argv) {
    const config = Object.assign(configs, argv)
    if (process.platform) {
        const url = `${config.host}:${config.port}`
        switch (process.platform) {
            case "darwin":
                exec(`open ${url}`)
                break
            case "win32":
                exec(`start chrome  ${url}`)
                break
        }
    }
    const server = http.createServer(async (req, res) => {
        const url = req.url.split('?')[0]
        if (url === "/favicon.ico") {
            const urls = join(__dirname, './icon/1.png')
            const w = fs.createReadStream(urls)
            w.pipe(res)
        } else {
            try {
                let absolutePath = join(__dirname, url)
                absolutePath = decodeURI(absolutePath)
                let urlPath = ''
                if (url === '/') {
                    urlPath = ''
                } else {
                    urlPath = url
                }
                stat = await statAsync(Buffer.from(absolutePath))
                if (stat.isFile()) {
                    const ifModifiedSince = req.headers['if-modified-since']
                    const ifNoneMatch = req.headers['if-none-match']
                    const r = fs.createReadStream(absolutePath)
                    const result = mameTypeFn(absolutePath)
                    if (config.cache.expires) {
                        res.setHeader("expries", new Date(Date.now() + (config.cache.maxAge * 1000)))
                    }
                    if (config.cache.lastModified) {
                        res.setHeader("last-modified", stat.mtime.toUTCString())
                    }
                    if (config.cache.etag) {
                        res.setHeader('Etag', etagFn(stat))
                    }
                    function zips() {
                        const ext = extname(absolutePath).split('.').pop()
                        if (config.compressExts.includes(ext)) {
                            const result = req.headers['accept-encoding']
                            if (!result.match(/\bgzip\b/) && !result.match(/\bdeflate\b/)) {
                                return r
                            }
                            if (result.match(/\bgzip\b/)) {
                                res.setHeader("Content-Encoding", "gzip")
                                return r.pipe(createGzip())
                            }

                            if (result.match(/\bdeflate\b/)) {
                                res.setHeader("Content-Encoding", "deflate")
                                return r.pipe(createDeflate())
                            }
                        }
                    }

                    const zipStream = zips()

                    if (ifNoneMatch === etagFn(stat) || ifModifiedSince === stat.mtime.toUTCString()) {
                        res.writeHead(304, 'use cache', {
                            "Content-Type": result
                        })
                        zipStream.pipe(res)
                    } else {
                        res.writeHead(200, 'not cache', {
                            "Content-Type": result
                        })
                        zipStream.pipe(res)
                    }

                } else if (stat.isDirectory()) {
                    const result = await readdirAsync(absolutePath)
                    const url = join(__dirname, './jade/index.jade')
                    const html = jade.renderFile(url, { data: result, urlPath })
                    res.end(html)
                }
            } catch {
                const url = join(__dirname, './jade/404.jade')
                const html = jade.renderFile(url)
                res.end(html)
            }
        }
    })

    server.listen(config.port, config.host, (err) => {
        if (err) {
            console.log(err)
        } else {
            console.log(`服务器运行在:${config.host}:${config.port}`)
        }
    })
}