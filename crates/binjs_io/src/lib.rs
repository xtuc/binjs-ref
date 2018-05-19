#![feature(box_patterns)]
#![feature(vec_resize_default)]

extern crate binjs_shared;

extern crate brotli;
extern crate flate2;
extern crate itertools;
extern crate lzw;
#[macro_use]
extern crate log;
extern crate priority_queue;
extern crate rand;
extern crate vec_map;
extern crate xml as xml_rs;

use std::cell::RefCell;
use std::rc::Rc;

#[derive(Debug)]
pub enum TokenWriterError {
    InvalidOffsetField,
    WriteError(std::io::Error),
}

#[derive(Debug)]
pub enum TokenReaderError {
    ReadError(std::io::Error),
    BadLength { expected: usize, got: usize },
    BadHeader,
    BadCompression(std::io::Error),
    EndOffsetError {
        start: u64,
        expected: u64,
        found: u64,
        description: String,
    },
    BadStringIndex(u32),
    InvalidValue,
    BadKindIndex(u32),
    Encoding(std::string::FromUtf8Error),
    EmptyNodeName,
    EmptyFieldName,
    EmptyVariant,
    EmptyBool,
    EmptyString,
    BadEnumVariant,
}


/// Byte-level utilities for writing token readers/writers.
pub mod bytes;

/// Definition of TokenReader/TokenWriter traits.
mod io;
pub use io::*;

pub mod labels;

/// A simple implementation of TokenReader/TokenWriter,
/// designed specifically to help debug implementations
/// of grammar encoders/decoders.
pub mod simple;

/// An optimization of TokenReader/TokenWriter,
/// designed to minimize the size of the file.
pub mod multipart;

/// A tree comperssion mechanism.
pub mod repair;

pub mod xml;

mod util;

pub mod mru;

#[derive(Clone)]
pub enum NumberingStrategy {
    MRU,
    GlobalFrequency,

    Prediction,
}

#[derive(Clone, Debug)]
enum Compressing {
    Uncompressed(Rc<RefCell<Vec<u8>>>),
    Compressed {
        data: Rc<Vec<u8>>,
        result: bytes::compress::CompressionResult,
    },
}
/// Instructions for a single section (grammar, strings, tree, ...)
#[derive(Clone, Debug)]
pub struct CompressionTarget {
    data: Compressing,
    format: bytes::compress::Compression,
}
impl CompressionTarget {
    pub fn new(format: bytes::compress::Compression) -> Self {
        Self {
            data: Compressing::Uncompressed(Rc::new(RefCell::new(vec![]))),
            format,
        }
    }
    pub fn done(&mut self) -> std::result::Result<(Rc<Vec<u8>>, bytes::compress::CompressionResult), std::io::Error> {
        let (data, result) = match self.data {
            Compressing::Compressed { ref result, ref data } => return Ok((data.clone(), result.clone())),
            Compressing::Uncompressed(ref data) => {
                let mut buf = vec![];
                let result = self.format.compress(&data.borrow().as_ref(), &mut buf)?;
                (Rc::new(buf), result)
            }
        };
        self.data = Compressing::Compressed {
            result: result.clone(),
            data: data.clone(),
        };
        Ok((data, result))
    }
    pub fn reset(&mut self) {
        self.data = Compressing::Uncompressed(Rc::new(RefCell::new(vec![])));
    }
    pub fn len(&self) -> usize {
        match self.data {
            Compressing::Uncompressed(ref data) => data.borrow().len(),
            Compressing::Compressed { ref result, .. } => result.before_bytes,
        }
    }
}
impl std::io::Write for CompressionTarget {
    fn write(&mut self, data: &[u8]) -> std::result::Result<usize, std::io::Error> {
        match self.data {
            Compressing::Uncompressed(ref buf) => {
                let mut borrow = buf.borrow_mut();
                borrow.extend_from_slice(data);
                Ok(borrow.len())
            },
            _ => panic!("Attempting to add data to a CompressionTarget that is already closed")
        }
    }
    fn flush(&mut self) -> std::result::Result<(), std::io::Error> {
        Ok(())
    }
}
impl Default for CompressionTarget {
    fn default() -> Self {
        Self::new(bytes::compress::Compression::Identity)
    }
}

pub enum Format {
    Simple {
        stats: Rc<RefCell<simple::Statistics>>
    },
    Multipart {
        targets: multipart::Targets,
        stats: Rc<RefCell<multipart::Statistics>>
    },
    TreeRePair,
    XML,
}
impl Format {
    pub fn new(format: &Format) -> Format {
        use multipart::WriteOptions;
        match *format {
            Format::Simple { .. } => Format::Simple { stats: Default::default() },
            Format::Multipart { ref options, .. } => Format::Multipart {
                stats: Default::default(),
                options: WriteOptions::new(options),
            },
            Format::TreeRePair => Format::TreeRePair,
            Format::XML => Format::XML,
        }
    }
}
