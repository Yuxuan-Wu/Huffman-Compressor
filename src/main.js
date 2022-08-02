/**
 * Variable Declaration & Initialization
 * =====================================
 */

const fileIO = require("fs");
const { dialog, Menu } = require("@electron/remote");

//HTML elements
const compressBtn = document.querySelector("#compressBtn");
const decompressBtn = document.querySelector("#decompressBtn");

/**
 * Bind Event Listeners
 * ====================
 */

compressBtn.onclick = selectFile;

decompressBtn.onclick = () => {

};

/**
 * File IO Operations
 */
function selectFile() {
    dialog.showOpenDialog({
        properties: ['openFile']
    }).then(function (response) {
        if (!response.canceled) {
            //handle file
            let filePath = response.filePaths[0];
            let directoryPath = filePath.slice(0, filePath.lastIndexOf("\\"));
            readFile(filePath);
            //storeFile("compressed@" + Date.now(), directoryPath);
        } else {
            console.log("no file selected");
        }
    });
}

function compressFile() {

}

function readFile(path) {
    fileIO.readFile(path, "utf-8", function(err, data) {
        if (err) throw err;

        console.log(data);
    });
}

function storeFile(fname, dir) {
    fileIO.writeFile(dir + "\\" + fname + '.txt', 'Hello content!', function (err) {
        if (err) throw err;
        console.log('Saved!');
    });
}