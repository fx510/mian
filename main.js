document.addEventListener('DOMContentLoaded', function () {
    // console.log('DOM fully loaded and parsed');

    // Access the PHP variables from the global phpVars object
    const csrf = phpVars.csrf;
    let currentDir = phpVars.currentDir;
    const isEnc = phpVars.isEnc;
    const key = CryptoJS.enc.Utf8.parse(phpVars.encryptionKey);
    const homeDir = phpVars.currentDir;
    let updir;
    // Terminal functionality
    var path = phpVars.terPWD;
    var command = '';
    var command_history = [];
    var history_index = 0;
    var suggest = false;
    var blink_position = 0;
    var autocomplete_position = 0;
    var autocomplete_search_for = '';
    var autocomplete_temp_results = [];
    var autocomplete_current_result = '';
    let commands_list = phpVars.cmList;
    // Initialize Monaco Editor
    let editor;

    // console.log('CSRF Token:', csrf);
    // console.log('Current Directory:', currentDir);
    // console.log('Is Encrypted:', isEnc);

    // Initialize variables
    let currentPage = 1;
    let totalPages = 1;
    let currentSort = { column: 'name', direction: 'asc' };
    let files = []; // Define files as a global variable

    // Clipboard state
    let clipboard = { action: "", path: [] };

    // Initialize the file manager
    initializeFileManager(csrf, currentDir, isEnc, key);

    // Event listener for "Select All" checkbox
    const selectAllCheckbox = document.getElementById('selectAll');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function (event) {
            const isChecked = event.target.checked;
            const fileCheckboxes = document.querySelectorAll('.file-checkbox');
            fileCheckboxes.forEach(checkbox => {
                checkbox.checked = isChecked;
                updateSelectedFiles(checkbox.dataset.file, isChecked);
            });
        });
    }

    // Event listener for individual file checkboxes
    const fileList = document.getElementById('fileList');
    if (fileList) {
        fileList.addEventListener('change', function (event) {
            if (event.target.classList.contains('file-checkbox')) {
                const isChecked = event.target.checked;
                updateSelectedFiles(event.target.dataset.file, isChecked);

                // Update the state of the "Select All" checkbox
                const fileCheckboxes = document.querySelectorAll('.file-checkbox');
                const allChecked = Array.from(fileCheckboxes).every(checkbox => checkbox.checked);
                const anyChecked = Array.from(fileCheckboxes).some(checkbox => checkbox.checked);

                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = allChecked;
                    selectAllCheckbox.indeterminate = !allChecked && anyChecked;
                }
            }
        });
    }

    // Event delegation for delete button
    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('fa-trash-alt')) {
            const fileName = event.target.dataset.file;
            deleteFile(fileName, csrf, currentDir, key, isEnc);
        }
    });

    // Function to save currently checked checkboxes to localStorage
    function saveSelectedCheckboxes() {
        const selectedFiles = Array.from(document.querySelectorAll('.file-checkbox:checked'))
            .map(checkbox => checkbox.dataset.file)
            .filter(file => file !== '.' && file !== '..'); // Exclude . and ..

        // Save the selected files to localStorage
        localStorage.setItem('selectedFiles', JSON.stringify(selectedFiles));

        // Return the array of selected files
        return selectedFiles;
    }

    // Add click event for "Create Folder" icon
    $('.fa-folder-plus').click(function () {
        showRenameDialog(
            'Create Folder',
            'Enter the name of new folder: ',
            'mkdir',
            'NewFolder',
            (dirName) => {
                if (dirName) {
                    data = {
                        csrf: csrf,
                        action: 'mkdir',
                        dir: currentDir,
                        dirName: dirName
                    };
                    handleCreate(data, 'folder', key, isEnc, currentDir, csrf);
                }
            }
        );
    });

    // Add click event for "Create File" icon
    $('.fa-file-circle-plus').click(function () {
        showRenameDialog(
            'Create File',
            'Enter the name of new File: ',
            'touch',
            'File',
            (dirName) => {
                if (dirName) {
                    data = {
                        csrf: csrf,
                        action: 'touch',
                        dir: currentDir,
                        dirName: dirName
                    };
                    handleCreate(data, 'file', key, isEnc, currentDir, csrf);
                }
            }
        );
    });

    // Add search functionality
    $('#searchBar').on('keyup', function () {
        renderFiles(fileManagerState.files, currentDir, csrf, key, isEnc);
    });

    
    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('fa-download')) {
            const filePath = event.target.dataset.file;
            downloadFile(filePath, csrf, key, isEnc);
        }
    });

    // Infinite scroll
    $(window).on('scroll', function () {
        if ($(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
            let itemLimitElement = document.getElementById('itemLimit').value;
            if (fileManagerState.currentPage < fileManagerState.totalPages && !fileManagerState.isLoading) {
                // alert(fileManagerState.currentPage);
                fileManagerState.currentPage++;
                loadDirectory(currentDir, fileManagerState.currentPage, csrf, key, isEnc,itemLimitElement);
            }
        }
    });

    // Add sorting functionality
    $('th[data-sort]').click(function () {
        const column = $(this).data('sort'); // Get the column to sort by

        // Update sorting state
        if (fileManagerState.currentSort.column === column) {
            // Toggle direction if the same column is clicked
            fileManagerState.currentSort.direction = fileManagerState.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // Set new column and default to ascending order
            fileManagerState.currentSort.column = column;
            fileManagerState.currentSort.direction = 'asc';
        }

        // Sort and re-render files
        sortFiles();
        renderFiles(fileManagerState.files, currentDir, csrf, key, isEnc);
    });

    // Event listener for directory links
    $(document).on('click', '.directory-link', function (e) {
        e.preventDefault();
        let itemLimitElement = document.getElementById('itemLimit').value;

        const newDir = $(this).data('path');
        if (newDir && newDir !== currentDir) {
            currentDir = newDir;  
            updir = currentDir;
            console.log(updir);
            updateCurrentPath(); 
            loadDirectory(currentDir, 1, csrf, key, isEnc,itemLimitElement);  
        }
    });

    // Function to update the current path in the UI
    function updateCurrentPath() {
        updateBreadcrumbs(currentDir); // Update breadcrumbs
    }

    // Function to generate breadcrumbs
    function updateBreadcrumbs(path) {
        const breadcrumbsContainer = $('#breadcrumbs ol');
        const parts = path.split('/').filter(part => part !== ''); // Split path into parts
        let breadcrumbsHtml = '';

        // Add Home link
        breadcrumbsHtml += `
            <li class="inline-flex items-center">
                <a href="#" class="breadcrumb-link" data-path="/">
                    /
                </a>
            </li>
        `;

        // Add other parts of the path
        parts.forEach((part, index) => {
            const partialPath = '/' + parts.slice(0, index + 1).join('/'); // Build partial path
            breadcrumbsHtml += `
                <li class="inline-flex items-center">
                    <i class="fas fa-chevron-right mx-2 text-gray-500"></i>
                    <a href="#" class="breadcrumb-link text-gray-500" data-path="${partialPath}">${part}</a>
                </li>
            `;
        });

        breadcrumbsContainer.html(breadcrumbsHtml);
    }

    // Add double-click event listener to the #breadcrumbs element
    $('#breadcrumbs').on('dblclick', function (e) {
        console.log('Double-click detected');
        e.preventDefault(); // Prevent default behavior

        const $container = $('#breadcrumbs ol');
        const originalPath = currentDir; // Get the current path (or use a custom variable)
        const $input = $('<input>', {
            type: 'text',
            value: originalPath,
            class: 'w-96 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
        });
        console.log('currentDir' + currentDir);
        console.log('originalPath' + originalPath);

        // Replace the entire breadcrumb with the input field
        $container.html(`<li class="inline-flex items-center">${$input.prop('outerHTML')}</li>`);

        // Focus the input field
        $container.find('input').focus();

        // Handle input field blur (when focus is lost)
        $container.find('input').on('blur', function () {
            const newPath = $(this).val().trim();
            if (newPath && newPath !== originalPath) {
                // Update the breadcrumbs with the new path
                currentDir = newPath;
                updateBreadcrumbs(newPath);
                loadDirectory(newPath, 1, csrf, key, isEnc); // Load the new directory

                // Handle the path change logic here (e.g., update the URL or perform navigation)
                console.log(`Updated breadcrumb path to: ${newPath}`);
            } else {
                loadDirectory(newPath, 1, csrf, key, isEnc); // Load the new directory
                currentDir = newPath;

                // Revert to the original path if no change or empty
                updateBreadcrumbs(originalPath);
            }
        });

        // Handle Enter key press
        $container.find('input').on('keypress', function (e) {
            if (e.which === 13) { // Enter key
                $(this).blur(); // Trigger blur event to save changes
            }
        });
    });

    // Event listener for "Go to Home" button
    $('#goHome').click(function () {
        currentDir = homeDir; // Update current directory to home directory
        updateCurrentPath(); // Update the UI
        loadDirectory(currentDir, 1, csrf, key, isEnc); // Load the home directory
    });

    // Event listener for breadcrumb links
    $(document).on('click', '.breadcrumb-link', function (e) {
        e.preventDefault();
        const newDir = $(this).data('path');
        if (newDir && newDir !== currentDir) {
            currentDir = newDir; // Update current directory
            updateCurrentPath(); // Update the UI
            updir = currentDir;
            console.log(updir);
            loadDirectory(currentDir, 1, csrf, key, isEnc); // Load the new directory
        }
    });

    // Bulk actions
    $('#bulkActions').change(function () {
        const action = $(this).val(); // Get selected action

        if (fileManagerState.selectedFiles.length === 0 && action !== 'paste') {
            triggerAlert('info', 'No files selected! Please select files to perform bulk actions.');
            resBulk();
            return;
        }

        switch (action) {
            case 'delete':
                // Show confirmation dialog for bulk delete
                showConfirmation(
                    'Delete Files',
                    `Are you sure you want to delete ${fileManagerState.selectedFiles.length} file(s)?`,
                    'Delete',
                    () => {
                        performBulkAction('delete', fileManagerState.selectedFiles, currentDir, csrf, key, isEnc);
                    }
                );
                break;

            case 'zip':
                // Show input dialog for zip file name
                showRenameDialog(
                    'Create Zip Archive',
                    'Enter the name for the zip file: ',
                    'Create',
                    'archive.zip',
                    (zipFileName) => {
                        if (zipFileName) {
                            performBulkAction('zip', fileManagerState.selectedFiles, currentDir, csrf, key, isEnc, zipFileName);
                        }
                    }
                );
                break;

            case 'unzip':
                // Show input dialog for zip file name
                showConfirmation(
                    'Extract archive',
                    `Don't select different archive types`,
                    'Extract',
                    () => {
                        performBulkAction('unzip', fileManagerState.selectedFiles, currentDir, csrf, key, isEnc);
                    }
                );
                break;

            case 'copy':
                // Save selected file names to localStorage as an array
                saveToLocalStorage(fileManagerState.selectedFiles);
                triggerAlert('success', 'Files have been copied to clipboard!');
                break;

            case 'paste':
                // Retrieve file names from localStorage and send to server
                const fileNames = getFromLocalStorage();
                if (fileNames && fileNames.length > 0) {
                    performBulkAction('paste', fileNames, currentDir, csrf, key, isEnc);
                } else {
                    triggerAlert('warning', 'No file names found in local storage.');
                }
                resBulk();
                freeclipbroad();
                break;

            default:
                break;
        }
    });

    // Upload functionality
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadForm = document.getElementById('uploadForm');
    const uploadProgress = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    if (dropZone && fileInput && uploadForm && uploadProgress && progressBar && progressText) {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Highlight drop zone when dragging files over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('bg-blue-50', 'dark:bg-gray-600'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('bg-blue-50', 'dark:bg-gray-600'), false);
        });

        // Handle dropped files
        dropZone.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files; // Assign dropped files to the file input
                updir = currentDir;
                handleFiles(updir);
            }
        }

        // Handle file input change
        fileInput.addEventListener('change', handleFiles);

        // Click on drop zone to trigger file input
        dropZone.addEventListener('click', () => fileInput.click());

        // Function to handle files
        function handleFiles(updir) {
            uploadProgress.classList.remove('hidden');
            progressBar.style.width = '0%';
            progressText.textContent = 'Uploading...';

            const formData = new FormData(uploadForm);
            formData.append('updir', currentDir);
            formData.append('csrf', csrf); // Append CSRF token

            fetch('', {
                method: 'POST',
                body: formData,
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        progressText.textContent = 'Upload complete!';
                        setTimeout(() => uploadProgress.classList.add('hidden'), 3000);
                        loadDirectory(currentDir, 1, csrf, key, isEnc); // Refresh file list
                    } else {
                        progressText.textContent = data.error || 'Upload failed. Please try again.';
                    }
                })
                .catch(error => {
                    progressText.textContent = 'Upload failed. Please try again.';
                    console.error('Error:', error);
                });
        }
    }


    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('file-link')) {
            event.preventDefault(); // Prevent the default link behavior
            const filePath = event.target.dataset.file; // Get the file path
            viewEditFile(filePath, csrf, key, isEnc); // Call the viewEditFile function
        }
    });

    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('fa-file-edit')) {
            const filePath = event.target.dataset.file;
            viewEditFile(filePath, csrf, key, isEnc);
        }
    });

    function viewEditFile(filePath, csrf, key, isEnc) {
        // Fetch file content from the server
        sendRequest({ csrf, action: 'view_content', file: filePath }, key, isEnc)
            .then(response => {
                // Display the file content in the editor
                document.getElementById('editorModal').classList.remove('hidden');
                initializeEditor(response.content);
            })
            .catch(error => {
                triggerAlert('warning', error);
            });
    }

    document.getElementById('cancelEdit').addEventListener('click', function () {
        document.getElementById('editorModal').classList.add('hidden');
        if (editor) {
            editor.dispose(); // Clean up the editor
        }
    });

    document.getElementById('saveEdit').addEventListener('click', function () {
        const newContent = editor.getValue();
        const filePath = document.getElementById('editorModal').dataset.filePath;

        saveFileContent(filePath, newContent, csrf, key, isEnc);
    });

    function saveFileContent(filePath, content, csrf, key, isEnc) {
        if (!content) {
            triggerAlert('warning', 'File content is empty.');
            return;
        }

        const data = {
            csrf: csrf,
            action: 'save_content',
            file: filePath,
            content: content
        };

        sendRequest(data, key, isEnc)
            .then(() => {
                triggerAlert('success', 'File content saved successfully!');
                document.getElementById('editorModal').classList.add('hidden');
                if (editor) {
                    editor.dispose(); // Clean up the editor
                }
            })
            .catch(error => {
                triggerAlert('warning', error);
            });
    }

    function getLanguageFromFileName(fileName) {
        const extension = fileName.split('.').pop();
        switch (extension) {
            case 'js': return 'javascript';
            case 'php': return 'php';
            case 'html': return 'html';
            case 'css': return 'css';
            case 'json': return 'json';
            default: return 'plaintext';
        }
    }

    function viewEditFile(filePath, csrf, key, isEnc) {
        // Fetch file content from the server
        sendRequest({ csrf, action: 'view_content', file: filePath }, key, isEnc)
            .then(response => {
                // Display the file content in the editor
                document.getElementById('editorModal').classList.remove('hidden');
                document.getElementById('editorModal').dataset.filePath = filePath;
                const language = getLanguageFromFileName(filePath);
                initializeEditor(response.content, language);
            })
            .catch(error => {
                triggerAlert('warning', error);
            });
    }

    function initializeEditor(content, language = 'plaintext') {
        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.0/min/vs' } });
        require(['vs/editor/editor.main'], function () {
            editor = monaco.editor.create(document.getElementById('editorContainer'), {
                value: content,
                language: language,
                theme: document.documentElement.classList.contains('dark') ? 'vs-dark' : 'vs',
                automaticLayout: true,
                lineNumbers: 'on',
                minimap: { enabled: false }
            });
        });
    }


    $(document).ready(function () {
        // Function to handle keydown events
        function handleKeydown(e) {
            var keyCode = typeof e.which === "number" ? e.which : e.keyCode;

            /* Tab, Backspace and Delete key */
            if (keyCode === 8 || keyCode === 9 || keyCode === 46) {
                e.preventDefault();
                if (command !== '') {
                    if (keyCode === 8)
                        backSpace();
                    else if (keyCode === 46)
                        reverseBackSpace();
                    else if (keyCode === 9)
                        autoComplete();
                }
            }

            /* Ctrl + C */
            else if (e.ctrlKey && keyCode === 67) {
                autocomplete_position = 0;
                endLine();
                newLine();
                reset();
            }

            /* Enter */
            else if (keyCode === 13) {
                if (autocomplete_position !== 0) {
                    autocomplete_position = 0;
                    command = autocomplete_current_result;
                }

                if (command.toLowerCase().split(' ')[0] in commands)
                    commands[command.toLowerCase().split(' ')[0]](command.split(' ').slice(1));
                else if (command.length !== 0)
                    $.ajax({
                        type: 'POST',
                        async: false,
                        data: { command: command, path: path },
                        cache: false,
                        success: function (response) {
                            response = $.parseJSON(response);
                            path = response.path;
                            $('terminal content').append('<line><br>' + response.result + '</line>');
                        }
                    });

                endLine();
                addToHistory(command);
                newLine();
                reset();
                $('terminal content').scrollTop($('terminal content').prop("scrollHeight"));
            }

            /* Home, End, Left and Right (change blink position) */
            else if ((keyCode === 35 || keyCode === 36 || keyCode === 37 || keyCode === 39) && command !== '') {
                e.preventDefault();
                $('line.current bl').remove();

                if (autocomplete_position !== 0) {
                    autocomplete_position = 0;
                    command = autocomplete_current_result;
                }

                if (keyCode === 35)
                    blink_position = 0;

                if (keyCode === 36)
                    blink_position = command.length * -1;

                if (keyCode === 37 && command.length !== Math.abs(blink_position))
                    blink_position--;

                if (keyCode === 39 && blink_position !== 0)
                    blink_position++;

                printCommand();
                normalizeHtml();
            }

            /* Up and Down (suggest command from history)*/
            else if ((keyCode === 38 || keyCode === 40) && (command === '' || suggest)) {
                e.preventDefault();
                if (keyCode === 38
                    && command_history.length
                    && command_history.length >= history_index * -1 + 1) {

                    history_index--;
                    command = command_history[command_history.length + history_index];
                    printCommand();
                    normalizeHtml();
                    suggest = true;
                }
                else if (keyCode === 40
                    && command_history.length
                    && command_history.length >= history_index * -1
                    && history_index !== 0) {

                    history_index++;
                    command = (history_index === 0) ? '' : command_history[command_history.length + history_index];
                    printCommand();
                    normalizeHtml();
                    suggest = (history_index === 0) ? false : true;
                }
            }

            /* type characters */
            else if (keyCode === 32
                || keyCode === 222
                || keyCode === 220
                || (
                    (keyCode >= 45 && keyCode <= 195)
                    && !(keyCode >= 112 && keyCode <= 123)
                    && keyCode != 46
                    && keyCode != 91
                    && keyCode != 93
                    && keyCode != 144
                    && keyCode != 145
                    && keyCode != 45
                )
            ) {
                type(e.key);
                $('terminal content').scrollTop($('terminal content').prop("scrollHeight"));
            }
        }

        // Function to attach/detach keydown event listener based on terminal visibility
        function updateKeydownListener() {
            if ($('#terminal').is(':visible')) {
                // If terminal is visible, attach keydown event listener
                $(document).on('keydown', handleKeydown);
                // console.log('Keydown listener attached');
            } else {
                // If terminal is hidden, remove keydown event listener
                $(document).off('keydown', handleKeydown);
                // console.log('Keydown listener removed');
            }
        }

        // Initial check for visibility
        updateKeydownListener();

        // Handle tab changes
        $('[data-tabs-target]').on('click', function () {
            // Wait for the tab content to be visible
            setTimeout(() => {
                updateKeydownListener();
            }, 100);
        });
    });

    function reset() {
        command = '';
        history_index = 0;
        blink_position = 0;
        autocomplete_position = 0;
        autocomplete_current_result = '';
        suggest = false;
    }
    function endLine() {
        $('line.current bl').remove();
        $('line.current').removeClass('current');
    }
    function newLine() {
        $('terminal content').append('<line class="current"><path>' + path + '</path> <sp></sp> <t><bl></bl></t></line>');
    }
    function addToHistory(command) {
        if (command.length >= 2 && (command_history.length === 0 || command_history[command_history.length - 1] !== command))
            command_history[command_history.length] = command;
    }
    function normalizeHtml() {
        let res = $('line.current t').html();
        let nres = res.split(' ').length == 1 ? '<cm>' + res + '</cm>' : '<cm>' + res.split(' ')[0] + '</cm> <code>' + res.split(' ').slice(1).join(' ').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code>';

        $('line.current t').html(nres.replace('&lt;bl&gt;&lt;/bl&gt;', '<bl></bl>'));
    }
    function printCommand(cmd = '') {
        if (cmd === '')
            cmd = command;
        else
            blink_position = 0;

        let part1 = cmd.substr(0, cmd.length + blink_position);
        let part2 = cmd.substr(cmd.length + blink_position);

        $('line.current t').html(part1 + '<bl></bl>' + part2);
    }
    function type(t) {
        history_index = 0;
        suggest = false;

        if (autocomplete_position !== 0) {
            autocomplete_position = 0;
            command = autocomplete_current_result;
        }
        if (command[command.length - 1] === '/' && t === '/')
            return;

        let part1 = command.substr(0, command.length + blink_position);
        let part2 = command.substr(command.length + blink_position);
        command = part1 + t + part2;

        printCommand();
        normalizeHtml();
    }
    function backSpace() {
        if (autocomplete_position !== 0) {
            autocomplete_position = 0;
            command = autocomplete_current_result;
        }

        let part1 = command.substr(0, command.length + blink_position);
        let part2 = command.substr(command.length + blink_position);
        command = part1.substr(0, part1.length - 1) + part2;

        printCommand();
        normalizeHtml();
    }
    function reverseBackSpace() {
        let part1 = command.substr(0, command.length + blink_position);
        let part2 = command.substr(command.length + blink_position);
        command = part1 + part2.substr(1);

        if (blink_position !== 0)
            blink_position++;

        printCommand();
        normalizeHtml();
    }
    function autoComplete() {
        if (autocomplete_search_for !== command) {
            autocomplete_search_for = command;
            autocomplete_temp_results = [];

            if (command.split(' ').length === 1) {
                let cmdlist = commands_list.concat(Object.keys(commands));
                autocomplete_temp_results = cmdlist
                    .filter(function (cm) { return (cm.length > command.length && cm.substr(0, command.length).toLowerCase() == command.toLowerCase()) ? true : false; })
                    .reverse().sort(function (a, b) { return b.length - a.length; });
            }

            else if (command.split(' ').length === 2) {
                let cmd = command.split(' ')[0];
                let cmd_parameter = command.split(' ')[1];
                var temp_cmd = '';

                if (cmd === 'cd' || cmd === 'cp' || cmd === 'mv' || cmd === 'cat') {
                    switch (cmd) {
                        case "cd": temp_cmd = 'ls -d ' + cmd_parameter + '*/'; break;
                        case "cp": case "mv": temp_cmd = 'ls -d ' + cmd_parameter + '*/'; break;
                        case "cat": temp_cmd = 'ls -p | grep -v /'; break;
                        default: temp_cmd = '';
                    }

                    $.ajax({
                        type: 'POST',
                        async: false,
                        data: { command: temp_cmd, path: path },
                        cache: false,
                        success: function (response) {
                            response = $.parseJSON(response);
                            autocomplete_temp_results = response.result.split('<br>')
                                .filter(function (cm) { return (cm.length !== 0) ? true : false; });
                        }
                    });
                }
            }
        }

        if (autocomplete_temp_results.length && autocomplete_temp_results.length > Math.abs(autocomplete_position)) {
            autocomplete_position--;
            autocomplete_current_result = ((command.split(' ').length === 2) ? command.split(' ')[0] + ' ' : '') + autocomplete_temp_results[autocomplete_temp_results.length + autocomplete_position];
            printCommand(autocomplete_current_result);
            normalizeHtml();
        }
        else {
            autocomplete_position = 0;
            autocomplete_current_result = '';
            printCommand();
            normalizeHtml();
        }
    }

    var commands = {
        'clear': clear,
        'history': history
    };

    function clear() {
        $('terminal content').html('');
    }

    function history(arg) {
        var res = [];
        let start_from = arg.length ? Number.isInteger(Number(arg[0])) ? Number(arg[0]) : 0 : 0;

        if (start_from != 0 && start_from <= command_history.length)
            for (var i = command_history.length - start_from; i < command_history.length; i++) { res[res.length] = (i + 1) + ' &nbsp;' + command_history[i]; }
        else
            command_history.forEach(function (item, index) { res[res.length] = (index + 1) + ' &nbsp;' + item; });

        $('terminal content').append('<line>' + res.join('<br>') + '</line>');
    }

    updateCurrentPath();

    function getBreadcrumbLinkValue() {
        // Select the first element with the class "breadcrumb-link"
        const breadcrumbLink = document.querySelector(".breadcrumb-link");

        // Return the text content if the element exists, otherwise return null
        return breadcrumbLink ? breadcrumbLink.textContent.trim() : null;
    }



    document.getElementById("itemLimit").addEventListener("change", (e) => {
        const limit = parseInt(e.target.value, 10);
        console.log('currentDir ',currentDir);
        loadDirectory(currentDir, 1, csrf, key, isEnc, limit);


    });
});
