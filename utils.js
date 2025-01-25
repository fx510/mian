
function initializeFileManager(csrf, currentDir, isEnc, encryptionKey) {
    const key = isEnc === '1' ? (encryptionKey) : "null";


    // Event delegation for rename button
    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('fa-edit')) {
            const oldName = event.target.dataset.file;
            renameFile(oldName, csrf, currentDir, key, isEnc);
        }
    });




    // Event delegation for directory navigation
    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('directory-link')) {
            event.preventDefault();
            const newDir = event.target.dataset.path;
            if (newDir && newDir !== currentDir) {
                currentDir = newDir;
                loadDirectory(currentDir, 1, csrf, key, isEnc);
            }
        }
    });


    // Load the initial directory
    loadDirectory(currentDir, 1, csrf, key, isEnc);
}


function sendRequest(data, key, isEnc) {
    // Ensure CSRF token is included in every request
    if (!data.csrf) {
        throw new Error('CSRF token is missing.');
    }
 
    const jsonData = JSON.stringify(data);
    const encryptedData = ( isEnc === '1') ? encrypt(jsonData, key) : jsonData;
 
 

    return new Promise((resolve, reject) => {
        $.post('', encryptedData)
            .done(response => {
                try {
                    let decryptedResponse = isEnc === '1' ? decrypt(response, key) : response;
                    const result = JSON.parse(decryptedResponse);

                    if (result.error) {
                        reject(result.error); // Handle server-side errors
                    } else {
                        resolve(result); // Success
                    }
                } catch (error) {
                    reject('Failed to parse server response.');
                    triggerAlert('warning', "Failed to parse server response");

                }
            })
            .fail((jqXHR, textStatus, errorThrown) => {
                reject(`Network error: ${textStatus} - ${errorThrown}`);
                triggerAlert('warning', "Failed to response");

            });
    });
}
function showDialog(title, inputLabel, confirmButtonText, oldName, onConfirm) {
    const isDarkMode = document.documentElement.classList.contains('dark');

    Swal.fire({
        title: title,
        input: 'text',
        inputLabel: inputLabel,
        inputValue: oldName,
        showCancelButton: true,
        confirmButtonText: confirmButtonText,
        cancelButtonText: 'Cancel',
        customClass: {
            popup: isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900',
            confirmButton: isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded' : 'bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded',
            cancelButton: isDarkMode ? 'bg-gray-700 hover:bg-gray-800 text-white font-bold py-2 px-4 rounded' : 'bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded',
            input: isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-900 border-gray-300'
        },

    }).then((result) => {
        if (result.isConfirmed) {
            const newName = result.value.trim();
            onConfirm(newName); // Execute the callback with the new value
        }
    });
}
// confirm 
function showConfirmation(title, text, confirmButtonText, onConfirm) {
    const isDarkMode = document.documentElement.classList.contains('dark');

    Swal.fire({
        title: title,
        text: text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: confirmButtonText,
        cancelButtonText: 'Cancel',
        customClass: {
            popup: isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900',
            confirmButton: isDarkMode ? 'bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded' : 'bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded',
            cancelButton: isDarkMode ? 'bg-gray-700 hover:bg-gray-800 text-white font-bold py-2 px-4 rounded' : 'bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            onConfirm(); // Execute the callback if the user confirms
        }
    });
}
function renameFile(oldName, csrf, currentDir, key, isEnc) {
    // Call the SweetAlert2 dialog
    showDialog(
        'Rename File', // Title
        'Enter the new name for the file:', // Input label
        'Rename', // Confirm button text
        oldName, // Current name
        (newName) => {
            // Callback function executed when the user confirms
            if (newName && newName.trim() !== oldName) {
                sendRequest({ csrf, action: 'rename', oldName, newName: newName.trim(), dir: currentDir }, key, isEnc)
                    .then(() => {
                        triggerAlert('success', 'File renamed successfully!');
                        loadDirectory(currentDir, 1, csrf, key, isEnc); // Reload directory
                    })
                    .catch(error => {
                        triggerAlert('warning', error); // Show error message
                        console.error('Error renaming file:', error); // Log error for debugging
                    });
            }
        }
    );
}
 


function deleteFile(fileName, csrf, currentDir, key, isEnc) {
    console.log("currentDir : "+currentDir);
    showConfirmation(
        'Delete File', // Title
        `Are you sure you want to delete "${fileName}"?`, // Text
        'Delete', // Confirm button text
        () => {
            // Callback function executed when the user confirms
            sendRequest({ csrf, action: 'delete', file: fileName, dir: currentDir }, key, isEnc)
                .then(() => {
                    triggerAlert('success', `"${fileName}" has been deleted successfully!`);
                    loadDirectory(currentDir, 1, csrf, key, isEnc); // Reload directory
                })
                .catch(error => {
                    triggerAlert('warning', error); // Show error message
                    console.error('Error deleting file:', error); // Log error for debugging
                });
        }
    );
}
// function handleDirectoryResponse(response, isEnc, key, dir, page, csrf) {

//     let decryptedResponse = isEnc === '1' ? decrypt(response, key) : response;
//     console.log(key);
//     const result = JSON.parse(decryptedResponse);

//     try {


//         // console.log(response);


//         if (result.error) {
//             triggerAlert('warning', result.error);
//         } else {
//             fileManagerState.totalPages = result.totalPages;

//             if (page === 1) {
//                 fileManagerState.files = result.files; // Reset files for the first page
//                 renderFiles(result.files, dir, csrf, key, isEnc);
//             } else {
//                 fileManagerState.files = fileManagerState.files.concat(result.files); // Append new files
//                 appendFiles(result.files, dir, csrf, key, isEnc);
//             }

//         }

//     } catch (error) {
//         // triggerAlert('warning', 'An error occurred while loading the directory.');
//         // Log detailed error information to the console for debugging
//         // console.error('POST Request Failed:',error);
//         console.error(error);


//         // console.error('Response Text:', error.message);
//     }
// }
function progr() {
    if (isLoading) return;
    isLoading = true;
    NProgress.start();

}
function dprogr() {
    NProgress.done();
    isLoading = false;

}
function loadDirectory(dir, page, csrf, key, isEnc , itemsPerPage = 40) {

    progr();
     const data = {
        csrf: csrf,
        action: 'list',
        dir: dir,
        page: page,
        itemsPerPage: itemsPerPage
    };
    const jsonData = JSON.stringify(data);


    const encryptedData = isEnc === '1' ? encrypt(jsonData, key) : jsonData;

    $.post('', encryptedData, function (response) {
        handleDirectoryResponse(response, isEnc, key, dir, page, csrf);
        dprogr();
    }).fail(function () {
        triggerAlert('warning', 'An error occurred while loading the directory.');
        dprogr();


    });
}

function handleDirectoryResponse(response, isEnc, key, dir, page, csrf) {
    try {
        let decryptedResponse = isEnc === '1' ? decrypt(response, key) : response;

        if (decryptedResponse) {
            const result = JSON.parse(decryptedResponse);

            if (result.error) {
                triggerAlert('warning', result.error);
            } else {
                fileManagerState.files = result.files;
                fileManagerState.totalPages = result.totalPages;

                if (page === 1) {
                    renderFiles(result.files, dir, csrf, key, isEnc);
                } else {
                    appendFiles(result.files, dir, csrf, key, isEnc);
                }

                $('#currentPath').text('Current Path: ' + dir); // Update the current path in the UI
            }
        } else {
            triggerAlert('warning', 'Failed to decrypt response.');
        }
    } catch (error) {
        triggerAlert('warning', 'An error occurred while loading the directory.');
        console.error('Error:', error.message);
    }
}

function createFileRow(file, currentDir, csrf, key, isEnc) {
    // Determine the color for file.perms based on the 'wr' key
    const permsColor = file.wr ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

    return `
        <tr class="border-b border-gray-200 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700">
            <td class="py-1 px-3 text-left">
                <input type="checkbox" class="file-checkbox peer relative size-4 cursor-pointer appearance-none overflow-hidden rounded border border-gray-500 bg-gray-200 before:absolute before:inset-0 checked:border-sky-900 checked:before:bg-sky-900 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-gray-900 checked:focus:outline-sky-900 active:outline-offset-0 disabled:cursor-not-allowed dark:border-gray-500 dark:bg-gray-800 dark:checked:border-sky-400 dark:checked:before:bg-sky-400 dark:focus:outline-gray-300 dark:checked:focus:outline-sky-400"  data-file="${file.name}" />
            </td>
            <td class="py-3 px-6 text-left text-gray-900 dark:text-gray-300">
                <i class="fas ${file.icon} mr-2"></i>
                ${file.is_dir
                    ? `<a href="#" class="font-medium directory-link" data-path="${currentDir}/${file.name}">${file.name}</a>`
                    : `<a href="#" class="font-medium file-link" data-file="${currentDir + '/' + file.name}">${file.name}</a>`
                }
            </td>
            <td class="py-3 px-6 text-left text-gray-900 dark:text-gray-300">${file.size}</td>
            <td class="py-3 px-6 text-left text-gray-900 dark:text-gray-300">${file.mtime}</td>
            <td class="py-3 px-6 text-left text-gray-900 dark:text-gray-300">${file.owner}</td>
            <td class="py-3 px-6 text-left ${permsColor}">${file.perms}</td>
            <td class="py-3 px-6 text-left text-gray-900 dark:text-gray-300">
                ${!file.is_dir
                    ? `<i class="fas fa-edit text-yellow-600 dark:text-yellow-400 mr-2" title="Rename" data-file="${file.name}"></i>
                       <i class="fas fa-trash-alt text-red-600 dark:text-red-400 mr-2" title="Delete" data-file="${currentDir + '/' + file.name}"></i>
                       
                       <i class="fas fa-download text-green-600 dark:text-green-400" title="Download" data-file="${currentDir + '/' + file.name}"></i>`
                    : `<i class="fas fa-edit text-yellow-600 dark:text-yellow-400 mr-2" title="Rename" data-file="${file.name}"></i>
                       <i class="fas fa-trash-alt text-red-600 dark:text-red-400" title="Delete" data-file="${file.name}"></i>`
                }
            </td>
        </tr>
    `;
}
function triggerAlert(type, message) {
    document.dispatchEvent(new CustomEvent('show-alert', {
        detail: { type: type, message: message }
    }));
}

function encrypt(message, key) {
    return CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(message), key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    }).toString();
}

function decrypt(encryptedMessage, key) {
    return CryptoJS.AES.decrypt(encryptedMessage, key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    }).toString(CryptoJS.enc.Utf8);
}


function renderFiles(files, currentDir, csrf, key, isEnc) {
    const searchQuery = $('#searchBar').val().toLowerCase();
    const fileList = document.getElementById('fileList');

    // Filter files based on the search query
    const filteredFiles = files.filter(file =>
        file.name.toLowerCase().includes(searchQuery)
    );

    // Generate HTML for filtered files
    fileList.innerHTML = filteredFiles.map(file => createFileRow(file, currentDir, csrf, key, isEnc)).join('');
}

function appendFiles(files, currentDir, csrf, key, isEnc) {
    const searchQuery = $('#searchBar').val().toLowerCase();
    const fileList = document.getElementById('fileList');

    // Filter files based on the search query
    const filteredFiles = files.filter(file =>
        file.name.toLowerCase().includes(searchQuery)
    );

    // Generate HTML for filtered files and append to the list
    const html = filteredFiles.map(file => createFileRow(file, currentDir, csrf, key, isEnc)).join('');
    fileList.innerHTML += html;
}
function sortFiles() {
    const { column, direction } = fileManagerState.currentSort;

    fileManagerState.files.sort((a, b) => {
        let valueA, valueB;

        // Handle different columns
        switch (column) {
            case 'name':
                valueA = a.name.toLowerCase();
                valueB = b.name.toLowerCase();
                break;
            case 'size':
                valueA = a.size === 'dir' ? -1 : parseFloat(a.size);
                valueB = b.size === 'dir' ? -1 : parseFloat(b.size);
                break;
            case 'mtime':
                valueA = new Date(a.mtime).getTime();
                valueB = new Date(b.mtime).getTime();
                break;
            case 'owner':
                valueA = a.owner.toLowerCase();
                valueB = b.owner.toLowerCase();
                break;
            case 'perms':
                valueA = a.perms;
                valueB = b.perms;
                break;
            default:
                valueA = a.name.toLowerCase();
                valueB = b.name.toLowerCase();
        }

        // Handle sorting direction
        if (direction === 'asc') {
            return valueA > valueB ? 1 : -1;
        } else {
            return valueA < valueB ? 1 : -1;
        }
    });
}

function updateSelectedFiles(fileName, isChecked) {
    if (isChecked) {
        fileManagerState.selectedFiles.push(fileName);
    } else {
        fileManagerState.selectedFiles = fileManagerState.selectedFiles.filter(file => file !== fileName);
    }
    console.log('Selected Files:', fileManagerState.selectedFiles); // Debug
}

function performBulkAction(action, files, currentDir, csrf, key, isEnc, zipFileName = '') {
    progr();
    const data = {
        csrf: csrf,
        action: action,
        file: files,
        dir: currentDir,
        zipExt: zipFileName
    };
    const jsonData = JSON.stringify(data);
    const encryptedData = ( isEnc === '1') ? encrypt(jsonData, key) : jsonData;
 
    $.post('', encryptedData, function (response) {
        handleBulkActionResponse(response, isEnc, key, currentDir, csrf);
        resBulk();
        dprogr();
    }).fail(function () {
        triggerAlert('warning', 'An error occurred while performing the bulk action.');
        dprogr();

    });
}

function handleBulkActionResponse(response, isEnc, key, currentDir, csrf) {
    try {
        let decryptedResponse = isEnc === '1' ? decrypt(response, key) : response;
        const result = JSON.parse(decryptedResponse);
        console.error('result:', isEnc);

        if (result.error) {
            triggerAlert('warning', result.error);
        } else {
            triggerAlert('success', 'Bulk action completed successfully!');
            loadDirectory(currentDir, 1, csrf, key, isEnc); // Reload directory
            fileManagerState.selectedFiles = []; // Clear selected files
            document.getElementById('selectAll').checked = false; // Uncheck "Select All"
            resBulk();

        }
        freeclipbroad();
    } catch (error) {
        triggerAlert('warning', 'Failed to parse server response.');
        freeclipbroad();
        console.error('Error:'+ error);
    }
}


function resBulk() {
    // Reset to the default option
    let bulkActionsDropdown = document.getElementById('bulkActions');
    bulkActionsDropdown.value = '';
}
// Function to save file names to localStorage
function saveToLocalStorage(fileNames) {
    try {
        localStorage.setItem('copiedFiles', JSON.stringify(fileNames));
        console.log('File names saved to localStorage:', fileNames);
    } catch (error) {
        console.error('Failed to save file names to localStorage:', error);
        triggerAlert('warning', 'Failed to save file names to local storage.');
    }
}

// Function to retrieve file names from localStorage
function getFromLocalStorage() {
    try {
        const fileNames = JSON.parse(localStorage.getItem('copiedFiles'));
        console.log('File names retrieved from localStorage:', fileNames);
        return fileNames || [];
    } catch (error) {
        console.error('Failed to retrieve file names from localStorage:', error);
        triggerAlert('warning', 'Failed to retrieve file names from local storage.');
        return [];
    }
}

function freeclipbroad() {
    localStorage.getItem('copiedFiles')
    localStorage.removeItem('copiedFiles');

}
function handleCreate(data, type, key, isEnc, currentDir, csrf) {
    if (!['file', 'folder'].includes(type)) {
        triggerAlert("warning", "Invalid type. Only file or folder are allowed");
        return;
    }

 
    sendRequest(data, key, isEnc)

        .then(() => {
            loadDirectory(currentDir, 1, csrf, key, isEnc); // Reload directory
        })
        .catch(error => {
            triggerAlert('warning', error); // Show error message
        });


}

function downloadFile(filePath, csrf, key, isEnc) {
    const data = {
        csrf: csrf,
        action: 'download',
        file: filePath
    };

    const jsonData = JSON.stringify(data);
    const encryptedData = isEnc === '1' ? encrypt(jsonData, key) : jsonData;

    // Send the request to the server
    fetch('', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: encryptedData
    })
    .then(response => {
        if (response.ok) {
            return response.blob(); // Get the file as a Blob
        } else {
            throw new Error('Failed to download file');
        }
    })
    .then(blob => {
        // Create a temporary URL for the Blob
        const url = window.URL.createObjectURL(blob);

        // Create a link element and trigger the download
        const a = document.createElement('a');
        a.href = url;
        a.download = filePath.split('/').pop(); // Set the file name
        document.body.appendChild(a);
        a.click();

        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    })
    .catch(error => {
        console.error('Error downloading file:', error);
        triggerAlert('warning', 'Failed to download file. Please try again.');
    });
}
 

function showEditDialog(filePath, content, csrf, key, isEnc) {
    const isDarkMode = document.documentElement.classList.contains('dark');

    Swal.fire({
        title: 'Edit File Content',
        html: `
            <textarea id="fileContent" class="w-full h-64 p-2 border rounded ${
                isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-900 border-gray-300'
            }">${content}</textarea>
        `,
        showCancelButton: true,
        confirmButtonText: 'Save',
        cancelButtonText: 'Cancel',
        customClass: {
            popup: isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900',
            confirmButton: isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded' : 'bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded',
            cancelButton: isDarkMode ? 'bg-gray-700 hover:bg-gray-800 text-white font-bold py-2 px-4 rounded' : 'bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded',
            input: isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-900 border-gray-300'
        },
        didOpen: () => {
            // Focus the textarea when the modal opens
            document.getElementById('fileContent').focus();
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const newContent = document.getElementById('fileContent').value;
            saveFileContent(filePath, newContent, csrf, key, isEnc);
        }
    });
}
 
function saveFileContent(filePath, content, csrf, key, isEnc) {
    progr();
    const data = {
        csrf: csrf,
        action: 'save_content',
        file: filePath,
        content: content
    };

    sendRequest(data, key, isEnc)
        .then(() => {
            triggerAlert('success', 'File content saved successfully!');
        })
        .catch(error => {
            triggerAlert('warning', error);
            dprogr
        });
        dprogr();
}



