/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)
chai.use(require('chai-string'))
const Keystore = require('..').Keystore
const os = require('os')
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')

describe('keystore', () => {
  const store = path.join(os.tmpdir(), 'test-keystore')
  const passPhrase = 'this is not a secure phrase'
  const rsaKeyName = 'rsa-key'

  after((done) => {
    rimraf(store, done)
  })

  it('needs a pass phrase to encrypt a key', () => {
    expect(() => new Keystore({ store: store})).to.throw()
  })

  it ('needs a NIST SP 800-132 non-weak pass phrase', () => {
    expect(() => new Keystore({ store: store, passPhrase: '< 20 character'})).to.throw()
  })

  it('needs a store to persist a key', () => {
    expect(() => new Keystore({ passPhrase: passPhrase})).to.throw()
  })

  describe('store', () => {
    it('is a folder', () => {
      const ks = new Keystore({ store: store, passPhrase: passPhrase})
      expect(fs.existsSync(store)).to.be.true()
      expect(fs.lstatSync(store).isDirectory()).to.be.true()
    })    
  })
  
  describe('key name', () => {
    it('is a valid filename', () => {
      const ks = new Keystore({ store: store, passPhrase: passPhrase})
      ks.removeKey('../../nasty', (err) => {
        expect(err).to.exist()
        expect(err).to.have.property('message', 'Invalid key name \'../../nasty\'')
      })
      ks.removeKey('', (err) => {
        expect(err).to.exist()
        expect(err).to.have.property('message', 'Invalid key name \'\'')
      })
      ks.removeKey('    ', (err) => {
        expect(err).to.exist()
        expect(err).to.have.property('message', 'Invalid key name \'    \'')
      })
      ks.removeKey(null, (err) => {
        expect(err).to.exist()
        expect(err).to.have.property('message', 'Invalid key name \'null\'')
      })
      ks.removeKey(undefined, (err) => {
        expect(err).to.exist()
        expect(err).to.have.property('message', 'Invalid key name \'undefined\'')
      })
    })    
  })

  describe('key creation', () => {
    const ks = new Keystore({ store: store, passPhrase: passPhrase})

    it('can create RSA key', (done) => {
      ks.createKey(rsaKeyName, 'rsa', 2048, (err) => {
        expect(err).to.not.exist()
        done()
      })
    })

    it('can create ED25519 key', () => {
      expect.fail()
    })

    it('creates a PKCS #8 pem file in the store', () => {
      const pem = path.join(store, rsaKeyName + '.pem')
      expect(fs.existsSync(pem)).to.be.true()
      expect(fs.lstatSync(pem).isFile()).to.be.true()
      const contents = fs.readFileSync(pem, 'utf8')
      expect(contents).to.startsWith('-----BEGIN')
    })

    it('creates a PKCS #8 encrypted pem file in the store', () => {
      const pem = path.join(store, rsaKeyName + '.pem')
      const contents = fs.readFileSync(pem, 'utf8')
      expect(contents).to.startsWith('-----BEGIN ENCRYPTED PRIVATE KEY-----')
    })

    it('does not overwrite existing key', (done) => {
      ks.createKey(rsaKeyName, 'rsa', 2048, (err) => {
        expect(err).to.exist()
        done()
      })
    })

    it('cannot create the "self" key', (done) => {
      ks.createKey('self', 'rsa', 2048, (err) => {
        expect(err).to.exist()
        done()
      })
    })

    describe('implements NIST SP 800-131A', () => {
      it('disallows RSA length < 2048', (done) => {
        ks.createKey('bad-nist-rsa', 'rsa', 1024, (err) => {
          expect(err).to.exist()
          expect(err).to.have.property('message', 'Invalid RSA key size 1024')
          done()
        })
      })
    })

  })

  describe('key lists', () => {
    const ks = new Keystore({ store: store, passPhrase: passPhrase})

    it('contains existing keys', (done) => {
      ks.listKeys((err, keys) => {
        expect(err).to.not.exist()
        expect(keys).to.exist()
        expect(keys).to.deep.include({ KeyName: rsaKeyName })
        done()
      })
    })
  })

  describe('encryption', () => {
    const ks = new Keystore({ store: store, passPhrase: passPhrase})
    const plainData = Buffer.from('This a message from Alice to Bob')
    
    it('requires a known key name', (done) => {
      ks.encrypt('not-there', plainData, (err) => {
        expect(err).to.exist()
        done()
      })
    })
  
    it('requires some data', (done) => {
      ks.encrypt(rsaKeyName, null, (err) => {
        expect(err).to.exist()
        done()
      })
    })

    it('generates encrypted data and encryption algorithm', () => {
      ks.encrypt(rsaKeyName, plainData, (err, res) => {
        expect(err).to.not.exist()
        expect(res).to.have.property('data')
        expect(res).to.have.property('algorithm')
        done()
      })
    })
  })
  
  describe('key removal', () => {
    const ks = new Keystore({ store: store, passPhrase: passPhrase})

    it('cannot remove the "self" key', (done) => {
      ks.removeKey('self', (err) => {
        expect(err).to.exist()
        done()
      })
    })

    it('cannot remove an unknown key', (done) => {
      ks.removeKey('not-there', (err) => {
        expect(err).to.exist()
        done()
      })
    })

    it('can remove a known key', (done) => {
      ks.removeKey(rsaKeyName, (err) => {
        expect(err).to.not.exist()
        done()
      })
    })
})
})
