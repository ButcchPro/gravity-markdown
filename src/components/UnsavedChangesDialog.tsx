import { Button, Dialog, Text } from '@gravity-ui/uikit';

interface UnsavedChangesDialogProps {
  open: boolean;
  fileName: string;
  onSave: () => void;
  onDontSave: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({
  open,
  fileName,
  onSave,
  onDontSave,
  onCancel,
}: UnsavedChangesDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} hasCloseButton={false} size="s">
      <Dialog.Header caption="Unsaved Changes" />
      <Dialog.Body>
        <div className="unsaved-dialog-body">
          <Text>
            Do you want to save the changes to “{fileName}”? Your changes will be lost if you don’t
            save them.
          </Text>
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button onClick={onSave} view="action">Save</Button>
        <Button onClick={onDontSave} view="flat">{"Don't Save"}</Button>
        <Button onClick={onCancel} view="flat">Cancel</Button>
      </Dialog.Footer>
    </Dialog>
  );
}
