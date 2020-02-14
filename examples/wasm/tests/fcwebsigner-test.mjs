import * as assert from 'assert';
import secp256k1 from 'secp256k1';
import {verify_signature, transaction_parse, transaction_create, sign_transaction} from 'fcwebsigner';
import bip32 from 'bip32'
import {getDigest} from './utils.mjs'

//////////////////////////////////
//
//     Initiate variable
//
////////////////////////////////
const cbor_transaction = "885501fd1d0f4dfcd7e99afcb99a8326b7dc459d32c6285501b882619d46558f3d9e316d11b48dcf211327025a0144000186a0430009c4430061a80040";

const transaction = {
  "to": "t17uoq6tp427uzv7fztkbsnn64iwotfrristwpryy",
  "from": "t1xcbgdhkgkwht3hrrnui3jdopeejsoas2rujnkdi",
  "nonce": 1,
  "value": "100000",
  "gas_price": "2500",
  "gas_limit": "25000",
  "method": 0,
  "params": ""
}

const prv_root_key = "xprv9s21ZrQH143K49QgrAgAVELf6ue2tZNHYUc7yfj8JGZY9SpZ38u8EfhWi85GsA6grUeB36wXrbNTkjX9EfGP1ybbPRG4sdP2EPfY1SZ2BF5"
let node = bip32.fromBase58(prv_root_key)

//////////////////////////////////
//
//     Tests
//
////////////////////////////////
test('Parse Cbor Transaction', () => {
  assert.equal(JSON.stringify(transaction), transaction_parse(cbor_transaction))
})

test('Parse Cbor Transaction fail (extra bytes)', () => {
  let cbor_transaction_extra_bytes = cbor_transaction + "00";

  assert.throws(
    () => transaction_parse(cbor_transaction_extra_bytes),
    /CBOR error/
  );
})

test('Create Transaction', () => {
  assert.equal(cbor_transaction,transaction_create(JSON.stringify(transaction)))
});

test('Create Transaction Fail (missing nonce)', () => {
  let invalid_transaction = {
    "to": "t17uoq6tp427uzv7fztkbsnn64iwotfrristwpryy",
    "from": "t1xcbgdhkgkwht3hrrnui3jdopeejsoas2rujnkdi",
    "value": "100000",
    "gas_price": "2500",
    "gas_limit": "25000",
    "method": 0,
    "params": ""
  }

  assert.throws(
    () => transaction_create(JSON.stringify(invalid_transaction)),
    /missing field `nonce`/
  );

});

test('Sign Transaction', () => {
  let child = node.derivePath("m/44'/461'/0/0/0")

  try {
    var signature = sign_transaction(JSON.stringify(transaction), child.privateKey.toString("hex"));
  } catch(e) {
    assert.fail(e);
  }

  signature = Buffer.from(signature, 'hex')
  let message_digest = getDigest(Buffer.from(cbor_transaction, 'hex'))

  // Signature representation is R, S & V
  console.log("Signature :",signature.toString('hex'))
  console.log("Digest :", message_digest.toString('hex'))
  console.log("Public key :", child.publicKey.toString('hex'))

  assert.equal(
    true,
    // Remove the V value from the signature (last byte)
    secp256k1.ecdsaVerify(signature.slice(0,-1), message_digest, child.publicKey)
  )

  // Verify V value which is tha last byte of the signature
  assert.equal(0x1c, signature[64]);

});

test('Verify signature', () => {
  let child = node.derivePath("m/44'/461'/0/0/0");
  let message_digest = getDigest(Buffer.from(cbor_transaction, 'hex'));

  // Get hex signature in the format (R,S)
  let signature = secp256k1.ecdsaSign(message_digest, child.privateKey);

  // v = 27 + (y % 2) (https://bitcoin.stackexchange.com/questions/38351/ecdsa-v-r-s-what-is-v)
  let v = 27 + (signature.recid % 2);

  // Concat v value at the end of the signature
  let signatureRSV = Buffer.from(signature.signature).toString('hex') + Buffer.from([v]).toString('hex');

  console.log("RSV signature :", signatureRSV);
  console.log("Digest :", message_digest.toString('hex'))

  assert.equal(verify_signature(signatureRSV, message_digest.toString('hex')), true);
})
