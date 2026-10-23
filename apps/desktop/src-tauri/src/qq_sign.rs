// How y.qq.com signs and seals a request: a zzc signature over the plain JSON, and the JSON itself in an
// ag-1 body. Sending to musics.fcg with both is what makes the server answer searches and likes.
// Ported from the reference implementation at github.com/jixunmoe/qmweb-sign.
use aes_gcm::{Aes128Gcm, KeyInit, aead::Aead};
use base64::{Engine, engine::general_purpose::STANDARD};
use sha1::{Digest, Sha1};

const PART_1: [usize; 8] = [23, 14, 6, 36, 16, 40, 7, 19];
const PART_2: [usize; 8] = [16, 1, 32, 12, 19, 27, 8, 5];
const SCRAMBLE: [u8; 20] = [89, 39, 179, 150, 218, 82, 58, 252, 177, 52, 186, 123, 120, 64, 242, 133, 143, 161, 121, 179];

const REQUEST_KEY: [u8; 16] = [0xbd, 0x30, 0x5f, 0x10, 0xd0, 0xff, 0x74, 0xb6, 0xef, 0x54, 0xda, 0xb8, 0x35, 0xb5, 0xe1, 0xcf];
const RESPONSE_KEY: [u8; 21] = [
    0x7a, 0x3f, 0x8c, 0x1d, 0x5e, 0x9b, 0x2f, 0x0a, 0x6c, 0x4d, 0x7e, 0x8b, 0x1f, 0x3a, 0x5c, 0x9d, 0x0e, 0x2b, 0x6f, 0x4a, 0x81,
];

pub fn zzc_sign(payload: &str) -> String {
    let hash = hex::encode_upper(Sha1::digest(payload.as_bytes()));
    let hash = hash.as_bytes();
    // The web client indexes a 40 character hash at 40, which JavaScript reads as nothing. Skip it the same way.
    let pick = |at: &[usize]| at.iter().filter_map(|&i| hash.get(i)).map(|&b| b as char).collect::<String>();
    let scrambled: Vec<u8> = SCRAMBLE
        .iter()
        .enumerate()
        .map(|(i, v)| v ^ u8::from_str_radix(std::str::from_utf8(&hash[i * 2..i * 2 + 2]).unwrap_or("0"), 16).unwrap_or(0))
        .collect();
    let b64: String = STANDARD.encode(scrambled).chars().filter(|c| !"\\/+=".contains(*c)).collect();
    format!("zzc{}{}{}", pick(&PART_1), b64, pick(&PART_2)).to_lowercase()
}

// base64(nonce || AES-128-GCM(plain)).
pub fn ag1_seal(plain: &str) -> String {
    let nonce = rand::random::<[u8; 12]>();
    let cipher = Aes128Gcm::new_from_slice(&REQUEST_KEY).expect("16 byte key");
    let sealed = cipher.encrypt(&nonce.into(), plain.as_bytes()).expect("AES-GCM encrypt");
    STANDARD.encode([nonce.as_slice(), sealed.as_slice()].concat())
}

#[cfg(test)]
fn ag1_open_request(sealed: &str) -> Option<String> {
    let raw = STANDARD.decode(sealed).ok()?;
    let (nonce, body) = raw.split_at_checked(12)?;
    let cipher = Aes128Gcm::new_from_slice(&REQUEST_KEY).ok()?;
    let plain = cipher.decrypt(nonce.try_into().ok()?, body).ok()?;
    String::from_utf8(plain).ok()
}

// The response body is the JSON XORed with a repeating key. A few responses come back as plain JSON.
pub fn ag1_open_response(body: &[u8]) -> Vec<u8> {
    if body.first() == Some(&b'{') {
        return body.to_vec();
    }
    body.iter().zip(RESPONSE_KEY.iter().cycle()).map(|(a, b)| a ^ b).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    // Expected values come from the reference Python implementation.
    #[test]
    fn signs_like_the_reference() {
        assert_eq!(zzc_sign("123"), "zzcec1b555gzqzg7laztguyjl2bu20r6x1w50c55f60");
        assert_eq!(
            zzc_sign(r#"{"comm":{"ct":11},"req_0":{"module":"m","method":"x","param":{"q":"稻香"}}}"#),
            "zzcd0207f17nlkusguvddjzowfctbddecxa775c14f9"
        );
    }

    #[test]
    fn opens_a_request_the_reference_sealed() {
        let sealed = "PN+QluecRKpCR4AzEJIPLJR1RiIM9oMP4vOM3Tk7hu7YooxsQQZX0yGvyQQx1l/g4eeH";
        assert_eq!(ag1_open_request(sealed).as_deref(), Some(r#"{"code":0,"q":"稻香"}"#));
    }

    #[test]
    fn seals_a_request_it_can_open() {
        let plain = r#"{"comm":{},"req_0":{"q":"稻香"}}"#;
        assert_eq!(ag1_open_request(&ag1_seal(plain)).as_deref(), Some(plain));
        assert_ne!(ag1_seal(plain), ag1_seal(plain), "a fresh nonce each time");
    }

    #[test]
    fn opens_a_response_the_reference_sealed() {
        let sealed = hex::decode("011def723afe0d305c615cfa3d007e7aa69086ec185842").unwrap();
        assert_eq!(ag1_open_response(&sealed), r#"{"code":0,"q":"稻香"}"#.as_bytes());
        assert_eq!(ag1_open_response(br#"{"code":0}"#), br#"{"code":0}"#);
    }
}
