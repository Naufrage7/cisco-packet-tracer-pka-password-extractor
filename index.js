#!/usr/bin/env node

(async () => {
  const fs = require('fs')
  const zlib = require('zlib')
  const parseString = require('xml2js').parseString
  const argv = require('yargs')
    .option('pka', {
      type: 'string',
      description: 'Path to PKA',
      demandOption: true
    })
    .option('verbose', {
      type: 'boolean',
      description: 'Be verbose'
    })
    .option('xml', {
      type: 'string',
      description: 'Path where to save XML'
    })
    .argv

  const getCompressedFile = (filePath) => {
    let compressedContent = null

    try {
      compressedContent = Buffer.from(fs.readFileSync(filePath))
    } catch (e) {
      throw new Error(`Can't read PKA file`)
    }

    const compressedSize = compressedContent.length

    return {
      buffer: compressedContent,
      size: compressedSize
    }
  }

  const getUncompressedFile = (compressedFile) => {
    let buffer = []
    let size = compressedFile.size

    for (const byte of compressedFile.buffer) {
      buffer.push(byte ^ size)
      size = size - 1
    }

    buffer = buffer.slice(4)

    try {
      buffer = zlib.inflateSync(Buffer.from(buffer))
    } catch (e) {
      throw new Error(`Can't inflate PKA`)
    }

    const content = buffer.toString('utf8')

    return {
      buffer: buffer,
      content: content,
      size: content.length
    }
  }

  const getHashedPassword = async (xml) => {
    return new Promise((resolve) => {
      parseString(xml, (err, result) => {
        if (err)
          throw new Error(`Can't parse XML from PKA`)
        resolve(result.PACKETTRACER5_ACTIVITY.ACTIVITY[0]['$'].PASS)
      })
    })
  }

  let compressedFile = null
  let uncompressedFile = null
  let hashedPassword = null

  try {
    compressedFile = getCompressedFile(argv.pka)
    uncompressedFile = getUncompressedFile(compressedFile)
    hashedPassword = await getHashedPassword(uncompressedFile.content)
  } catch (e) {
    console.log(e.message)
    process.exit(1)
  }

  if (argv.verbose !== undefined) {
    console.log(`File size compressed : ${compressedFile.size} bytes`)
    console.log(`File size uncompressed : ${uncompressedFile.size} bytes`)
    console.log(`MD5 hashed password : ${hashedPassword}`)
  } else {
    console.log(`${hashedPassword}`)
  }

  if (argv.xml !== undefined) {
    try {
      fs.writeFileSync(argv.xml, uncompressedFile.content, 'utf8')
    } catch (e) {
      console.log(`Can't write XML output file`)
      process.exit(1)
    }
  }
})()