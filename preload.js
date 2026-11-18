const {
    contextBridge,
    ipcRenderer
} = require('electron');


contextBridge.exposeInMainWorld(
    'crypticLocker',
    {

        platform:
            process.platform,

        vaultExists: () => {

            return ipcRenderer.invoke(
                'vault:exists'
            );

        },

        getLoginSuccessMessage: () => {

            return ipcRenderer.invoke(
                'auth:get-success-message'
            );

        },

        checkVaultIntegrity: () => {

            return ipcRenderer.invoke(
                'vault:integrity-check'
            );

        },

        getSettings: () =>
            ipcRenderer.invoke(
                'settings:get'
            ),

        updateSettings: updates =>
            ipcRenderer.invoke(
                'settings:update',
                updates
            ),


        createVault: (password) => {

            return ipcRenderer.invoke(
                'vault:create',
                password
            );

        },


        getLockoutStatus: () => {

            return ipcRenderer.invoke(
                'vault:get-lockout-status'
            );

        },


        unlockVault: (password) => {

            return ipcRenderer.invoke(
                'vault:unlock',
                password
            );

        },


        changePassword: (
            currentPassword,
            newPassword
        ) => {

            return ipcRenderer.invoke(

                'vault:change-password',

                currentPassword,

                newPassword

            );

        },

        resetPassword: (
            recoveryKey,
            newPassword
        ) => {

            return ipcRenderer.invoke(
                'vault:reset-password',
                recoveryKey,
                newPassword
            );

        },

        getSessionStatus: () => {

            return ipcRenderer.invoke(
                'vault:session-status'
            );

        },


        lockVault: () => {

            return ipcRenderer.invoke(
                'vault:lock'
            );

        },

        verifyPassword: (password) => {

            return ipcRenderer.invoke(
                'vault:verify-password',
                password
            );

        },

        deleteVault: (password) => {

            return ipcRenderer.invoke(
                'vault:delete-vault',
                password
            );

        },

        exportVault: () => {

            return ipcRenderer.invoke(
                'vault:export-vault'
            );

        },

        importVault: () => {

            return ipcRenderer.invoke(
                'vault:import-vault'
            );

        },

        selectCapsuleFile: () => {

            return ipcRenderer.invoke(
                'vault:select-capsule-file'
            );

        },

        inspectCapsule: (filePathOrOptions, maybeTransferPassword) => {

            let filePath;
            let transferPassword;
            if (typeof filePathOrOptions === 'string') {
                filePath = filePathOrOptions;
                transferPassword = maybeTransferPassword;
            } else if (filePathOrOptions && typeof filePathOrOptions === 'object') {
                filePath = filePathOrOptions.filePath;
                transferPassword = filePathOrOptions.transferPassword || maybeTransferPassword;
            }

            return ipcRenderer.invoke(
                'vault:inspect-capsule',
                { filePath, transferPassword }
            );

        },

        exportCapsule: (itemsOrOptions, maybeTransferPassword) => {

            let items;
            let transferPassword;
            if (Array.isArray(itemsOrOptions)) {
                items = itemsOrOptions;
                transferPassword = maybeTransferPassword;
            } else if (itemsOrOptions && typeof itemsOrOptions === 'object') {
                items = itemsOrOptions.items;
                transferPassword = itemsOrOptions.transferPassword || maybeTransferPassword;
            }

            return ipcRenderer.invoke(
                'vault:export-capsule',
                { items, transferPassword }
            );

        },

        mergeCapsule: (filePathOrOptions, maybeTransferPassword) => {

            let filePath;
            let transferPassword;
            if (typeof filePathOrOptions === 'string') {
                filePath = filePathOrOptions;
                transferPassword = maybeTransferPassword;
            } else if (filePathOrOptions && typeof filePathOrOptions === 'object') {
                filePath = filePathOrOptions.filePath;
                transferPassword = filePathOrOptions.transferPassword || maybeTransferPassword;
            }

            return ipcRenderer.invoke(
                'vault:merge-capsule',
                { filePath, transferPassword }
            );

        },

        getHardwareProfile: () => {

            return ipcRenderer.invoke(
                'vault:get-hardware-profile'
            );

        },

        setIoAcceleration: (tierData) => {

            return ipcRenderer.invoke(
                'vault:set-io-acceleration',
                tierData
            );

        },


        addFile: (mode = 'copy') => {

            return ipcRenderer.invoke(
                'vault:add-file',
                mode
            );

        },


        getFiles: () => {

            return ipcRenderer.invoke(
                'vault:get-files'
            );

        },

        getVaultSettingsInfo: () => {

            return ipcRenderer.invoke(
                'vault:get-settings-info'
            );

        },

        openVaultStorageLocation: () => {

            return ipcRenderer.invoke(
                'vault:open-storage-location'
            );

        },

        getRecoveryKey: () => {

            return ipcRenderer.invoke(
                'vault:get-recovery-key'
            );

        },

        copyText: (text) => {

            return ipcRenderer.invoke(
                'clipboard:copy',
                text
            );

        },

        addFolder: (mode = 'copy') => {

            return ipcRenderer.invoke(
                'vault:add-folder',
                mode
            );

        },

        restoreFile: (
            fileId,
            removeFromVault = false
        ) => {

            return ipcRenderer.invoke(
                'vault:restore-file',
                fileId,
                removeFromVault
            );

        },


        deleteFile: (fileId) => {

            return ipcRenderer.invoke(
                'vault:delete-file',
                fileId
            );

        },


        restoreFolder: (
            folderId,
            removeFromVault = false
        ) => {

            return ipcRenderer.invoke(
                'vault:restore-folder',
                folderId,
                removeFromVault
            );

        },

        bulkDeleteItems: (
            items
        ) => {

            return ipcRenderer.invoke(
                'vault:bulk-delete',
                items
            );

        },

        bulkRestoreItems: (
            items,
            removeFromVault = false
        ) => {

            return ipcRenderer.invoke(
                'vault:bulk-restore',
                items,
                removeFromVault
            );

        },

        checkItemsStatus: (
            items
        ) => {

            return ipcRenderer.invoke(
                'vault:check-items-status',
                items
            );

        },


        deleteFolder: (folderId) => {

            return ipcRenderer.invoke(
                'vault:delete-folder',
                folderId
            );

        },


        getQuarantinedOrphans: () => {

            return ipcRenderer.invoke(
                'vault:get-quarantined-orphans'
            );

        },

        checkQuarantineOrphan: (orphanFileName) => {

            return ipcRenderer.invoke(
                'vault:check-orphan-recovery',
                orphanFileName
            );

        },

        recoverOrphan: (
            orphanFileName,
            removeFromQuarantine = false
        ) => {

            return ipcRenderer.invoke(
                'vault:recover-orphan',
                orphanFileName,
                removeFromQuarantine
            );

        },

        deleteQuarantinedOrphan: (
            orphanFileName
        ) => {

            return ipcRenderer.invoke(
                'vault:delete-quarantined-orphan',
                orphanFileName
            );

        },

        deleteAllInvalidQuarantinedOrphans: () =>

            ipcRenderer.invoke(
                'vault:delete-all-invalid-quarantined-orphans'
            ),

        onOperationProgress: (callback) => {

            const listener =
                (event, data) => {

                    callback(data);

                };


            ipcRenderer.on(
                'vault:operation-progress',
                listener
            );


            /*
                Return cleanup function so renderer
                can remove this listener if required.
            */

            return () => {

                ipcRenderer.removeListener(
                    'vault:operation-progress',
                    listener
                );

            };

        },

        cancelOperation: (
            operationId
        ) => {

            return ipcRenderer.invoke(
                'vault:cancel-operation',
                operationId
            );

        },

        onSessionLocked: (callback) => {

            if (
                typeof callback !== 'function'
            ) {

                return () => { };

            }


            const listener =
                (event, data) => {

                    callback(data);

                };


            ipcRenderer.on(
                'vault:session-locked',
                listener
            );


            /*
                Return cleanup function so the
                renderer can safely remove this
                listener when required.
            */

            return () => {

                ipcRenderer.removeListener(
                    'vault:session-locked',
                    listener
                );

            };

        }

    }
);