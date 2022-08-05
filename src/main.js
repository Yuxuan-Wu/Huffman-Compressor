/**
 * Variable Declaration & Initialization
 * =====================================
 */

const fileIO = require("fs");
const { dialog, Menu } = require("@electron/remote");
const PriorityQueue = require('priorityqueuejs');
var baseConverter = require('base-conversion');
var binaryToDecimal = baseConverter(2, 10);
var decimalToBinary = baseConverter(10, 2);

//HTML elements
const compressBtn = document.querySelector("#compressBtn");
const decompressBtn = document.querySelector("#decompressBtn");
var frequencyList = [];

/**
 * Bind Event Listeners
 * ====================
 */

compressBtn.onclick = () => {
    selectFile(compressFile);
};

decompressBtn.onclick = () => {
    selectFile(decompressFile);
};

/**
 * File IO Operations
 * ==================
 */
function selectFile(action) {
    dialog.showOpenDialog({
        properties: ['openFile']
    }).then(function (response) {
        if (!response.canceled) {
            //handle file
            let filePath = response.filePaths[0];
            action(filePath);
        } else {
            console.log("no file selected");
        }
    });
}

function decompressFile(path) {
    let binaryUint8 = fileIO.readFileSync(path);
    let buffer = Buffer.from(binaryUint8);

    //convert the unint8 array to a unint16 array
    let binaryUint16 = new Uint16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Uint16Array.BYTES_PER_ELEMENT);

    //construct the frequency list from the header
    frequencyList = [];
    let headerLength = binaryUint16[0];
    let charCount = 0;

    for (var i = 1; i < headerLength * 2 + 1; i += 2) {
        //data@i is the symbol, data@i+1 is the frequency
        frequencyList[String.fromCharCode(binaryUint16[i])]
            = binaryUint16[i + 1];
        charCount += binaryUint16[i + 1];
    }

    //construct a huffman tree from the frequency list
    let pq = new PriorityQueue(function (a, b) {
        return b.frequency - a.frequency;
    });
    let HFtree = new huffmanTree(frequencyList, pq);

    //2 (Uint8 are half the  size of Uint16) * {header length + header content}
    let readStartIndex = 2 * (1 + 2 * headerLength);
    let zerosToFill = binaryUint8[binaryUint8.length - 1];

    //retreive the encoded binary string
    let encodedMsg = "";
    for (var i = readStartIndex; i < binaryUint8.length - 2; i++) {
        encodedMsg += zeroFill(decimalToBinary(binaryUint8[i]));
    }
    encodedMsg += appendZero(decimalToBinary(binaryUint8[binaryUint8.length - 2]), zerosToFill);

    //decode and write to the decompressed file
    let decodeStream = new bitStream(encodedMsg);
    let decodedMsg = "";
    for (var i = 0; i < charCount; i++) {
        decodedMsg += HFtree.decode(decodeStream);
    }

    let directoryPath = path.slice(0, path.lastIndexOf("\\"));
    storeFile("decompressed@" + Date.now(), directoryPath, decodedMsg);
}

function compressFile(path) {
    fileIO.readFile(path, "utf-8", function (err, data) {
        if (err) throw err;

        //create a frequency list from file data
        createFreqList(data);

        //create a write stream to the compressed file
        let directoryPath = path.slice(0, path.lastIndexOf("\\"));
        let writeStream = fileIO.createWriteStream(directoryPath + "\\"
            + "compressed@" + Date.now());

        writeHeader(writeStream, frequencyList);

        //construct a huffman tree from the frequency list
        let pq = new PriorityQueue(function (a, b) {
            return b.frequency - a.frequency;
        });
        let HFtree = new huffmanTree(frequencyList, pq);

        //encode each character of file data using the huffman tree
        let encodedMsg = "";
        for (var i = 0; i < data.length; i++) {
            encodedMsg += HFtree.encode(data.charAt(i));
        }

        writeMsg(writeStream, encodedMsg);
    });
}

function storeFile(fname, dir, content) {
    let buffer = Buffer.from(content.buffer);

    fileIO.createWriteStream(dir + "\\" + fname).write(buffer);
}

/**
 * Huffman Tree
 */
class huffmanTree {
    constructor(freqList, pq) {

        this.leaves = [];

        let symbols = Object.keys(frequencyList);
        let tempNode = null;

        //populate the pq with huffmanNodes
        for (var symbol of symbols) {
            tempNode = new huffmanNode(symbol, freqList[symbol]);
            pq.enq(tempNode);
            this.leaves[symbol] = tempNode;
        }

        let nodeA, nodeB;

        while (pq.size() > 1) {
            //pop out the first two nodes
            nodeA = pq.deq();
            nodeB = pq.deq();

            //insert a new node with A&B's frequency combined and as their parent
            tempNode = new huffmanNode(nodeA.frequency + nodeB.frequency,
                nodeA.frequency + nodeB.frequency);
            tempNode.left = nodeA;
            tempNode.right = nodeB;
            nodeA.parent = tempNode;
            nodeB.parent = tempNode;
            pq.enq(tempNode);
        }

        //after the while loop, the root of the huffman tree is the first node of pq
        this.root = pq.peek();

    }

    encode(symbol) {

        let encodedSymbol = "";
        //get the leave node from symbol
        let currNode = this.leaves[symbol];

        //traverse from the leaf to the root
        while (currNode.parent !== null) {
            //0 if curr is the left child, 1 if right child
            if (currNode.parent.left === currNode) {
                encodedSymbol += "0";
            }
            else {
                encodedSymbol += "1";
            }
            currNode = currNode.parent;
        }

        //reverse the encoded message
        return encodedSymbol.split("").reverse().join("");

    }

    decode(inputStream) {

        let currNode = this.root;

        let currBit = undefined;
        while (currNode.left !== null || currNode.right !== null) {
            currBit = inputStream.readBit();
            if (currBit == "0") {
                currNode = currNode.left;
            }
            else if (currBit == "1") {
                currNode = currNode.right;
            }
            else {
                break;
            }
        }

        return currNode.symbol;

    }
}

class huffmanNode {

    constructor(symbol, frequency) {
        this.symbol = symbol;
        this.frequency = frequency;
        this.left = null;
        this.right = null;
        this.parent = null;
    }

}

class bitStream {

    constructor(bits) {
        this.index = 0;
        this.bit_str = bits;
    }

    readBit() {
        return this.bit_str.charAt(this.index++);
    }

    readBytes(num) {
        let bytes = (this.bit_str).substring(this.index, this.index + 8 * num);
        this.index += 8 * num;

        return bytes;
    }

}

/**
 * Auxiliary Functions
 * ===================
 */

function createFreqList(data) {
    for (var i = 0; i < data.length; i++) {
        //populate the frequency list with characters
        frequencyList[data.charAt(i)] = (frequencyList[data.charAt(i)] || 0) + 1;
    }
}

function writeHeader(stream, freqList) {
    let header = [];

    //length of the header is the first character in the encoded content
    header.push(Object.keys(freqList).length);

    //second part of the header: symbols and their frequencies
    for (var symbol of Object.keys(freqList)) {
        header.push(symbol.charCodeAt(0));
        header.push(freqList[symbol]);
    }

    //write the header to the write stream through a buffer
    stream.write(Buffer.from(new Uint16Array(header).buffer));
}

function writeMsg(stream, encodedMsg) {
    let inputStream = new bitStream(encodedMsg);
    let lastChunk, currChunk = inputStream.readBytes(1);
    let data = undefined;

    //write to the stream byte by byte
    do {
        lastChunk = currChunk;
        data = new Uint8Array(1);
        data[0] = parseInt(binaryToDecimal(currChunk));
        stream.write(Buffer.from(data.buffer));
        currChunk = inputStream.readBytes(1);
    } while (currChunk !== "");

    //find out how many zeros to fill for the last chunk of binary data
    //write the number to the end of the file
    data = new Uint8Array(1);
    data[0] = hiddenZeros(lastChunk);
    stream.write(Buffer.from(data.buffer));
}

function hiddenZeros(binary) {
    let compared = decimalToBinary(binaryToDecimal(binary));
    return binary.length - compared.length;
}

function zeroFill(binary) {
    let result = "00000000" + binary;
    return result.substring(result.length - 8);
}

function appendZero(binary, num) {
    if (num > 0) {
        return ("0" * num) + binary;
    }
    else {
        return binary;
    }
}

/*
function generateMsg(encodedMsg) {
    let msg = [];

    let inputStream = new bitStream(encodedMsg);
    let currChunk = inputStream.readBytes(2);

    do {
        msg.push(parseInt(binaryToDecimal(currChunk)));
        currChunk = inputStream.readBytes(2);
    } while (currChunk !== "");

    return new Uint16Array(msg);
}
*/

function concatenateUint16Arrays(a1, a2) {
    let resultArray = new Uint16Array(a1.length + a2.length);
    for (var i = 0; i < a1.length; i++) {
        resultArray[i] = a1[i];
    }
    for (var i = 0; i < a2.length; i++) {
        resultArray[a1.length + i] = a2[i];
    }

    return resultArray;
}

