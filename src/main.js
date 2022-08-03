/**
 * Variable Declaration & Initialization
 * =====================================
 */

const fileIO = require("fs");
const { dialog, Menu } = require("@electron/remote");

//HTML elements
const compressBtn = document.querySelector("#compressBtn");
const decompressBtn = document.querySelector("#decompressBtn");
const frequencyList = [];

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

    console.log(binaryUint16)
}

decompressFile("C:\\VSCode_Workspace\\Summer_2022_Project\\Text_Samples\\test");

function compressFile(path) {
    fileIO.readFile(path, "utf-8", function (err, data) {
        if (err) throw err;

        //create a frequency list from file data
        createFreqList(data);

        //generate the header for compressed file
        let encodedContent = generateHeader(frequencyList);

        //store the compressed file
        let directoryPath = path.slice(0, path.lastIndexOf("\\"));
        storeFile("compressed@" + Date.now(), directoryPath, encodedContent);
    });
}

function storeFile(fname, dir, content) {
    let buffer = Buffer.from(content.buffer);

    fileIO.createWriteStream(dir + "\\" + fname).write(buffer);
}

/**
 * Auxiliary Functions
 */

function createFreqList(data) {
    for (var i = 0; i < data.length; i++) {
        //populate the frequency list with characters
        frequencyList[data.charAt(i)] = (frequencyList[data.charAt(i)] || 0) + 1;
    }
}

function generateHeader(freqList) {
    let header = [];

    //length of the header is the first character in the encoded content
    header.push(Object.keys(freqList).length);

    //second part of the header: symbols and their frequencies
    for (var symbol of Object.keys(freqList)) {
        header.push(symbol.charCodeAt(0));
        header.push(freqList[symbol]);
    }

    console.log(new Uint16Array(header))

    return new Uint16Array(header);
}

//TODO: convert from char to int
//String.charCodeAt(0);