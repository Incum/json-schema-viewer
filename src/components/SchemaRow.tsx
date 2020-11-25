import { IRowRendererOptions, isParentNode, Tree, TreeListNode } from '@stoplight/tree-list';
import cn from 'classnames';
import { JSONSchema4 } from 'json-schema';
import { observer } from 'mobx-react-lite';
import * as React from 'react';
import { SchemaTree } from '../tree';

import { getNodeMetadata, getSchemaNodeMetadata } from '../tree/metadata';
import { GoToRefHandler, SchemaKind, SchemaTreeListNode } from '../types';
import { getPrimaryType } from '../utils/getPrimaryType';
import { hasRefItems, isArrayNodeWithItems, isRefNode } from '../utils/guards';
import { Caret, Description, Divider, Property, Validations } from './shared';
import { Select } from '@stoplight/ui-kit/Select'
import { Button } from '@stoplight/ui-kit';
import { addChildrenToTreeListNode } from '../utils/addChildrenToTreeListNode';

export interface ISchemaRow {
  className?: string;
  node: SchemaTreeListNode;
  rowOptions: IRowRendererOptions;
  onGoToRef?: GoToRefHandler;
  schemaTree: SchemaTree;
}

const ICON_SIZE = 12;
const ICON_DIMENSION = 20;
const ROW_OFFSET = 7;

const NodesSelect = Select.ofType<JSONSchema4>();

function getRelevantSchemaForRequireCheck(treeNode: SchemaTreeListNode): JSONSchema4 | JSONSchema4[] | null {
  const metadata = getNodeMetadata(treeNode);
  if (!('schemaNode' in metadata)) return null;
  if (isArrayNodeWithItems(metadata.schemaNode)) {
    return metadata.schemaNode.items;
  }

  return metadata.schema;
}

function isRequired(treeNode: SchemaTreeListNode) {
  if (treeNode.parent === null) return false;
  try {
    const { path } = getSchemaNodeMetadata(treeNode);
    if (path.length === 0) {
      return false;
    }

    const schema = getRelevantSchemaForRequireCheck(treeNode.parent);

    return (
      schema !== null &&
      !Array.isArray(schema) &&
      getPrimaryType(schema) === SchemaKind.Object &&
      Array.isArray(schema.required) &&
      schema.required.includes(String(path[path.length - 1]))
    );
  } catch {
    return false;
  }
}

const getCombinerOptions = (node: TreeListNode): JSONSchema4[] => {
  if (typeof node.metadata === 'object' && node.metadata !== null) {
    return node.metadata['properties'];
  }

  return [];
}

export const SchemaPropertyRow = observer<ISchemaRow>(({ node, onGoToRef, rowOptions, schemaTree }) => {
  const metadata = getSchemaNodeMetadata(node);
  const { schemaNode, path } = metadata;

  const parentSchemaNode =
    (node.parent !== null && Tree.getLevel(node.parent) >= 0 && getSchemaNodeMetadata(node.parent)?.schemaNode) || null;
  const description = 'annotations' in schemaNode ? schemaNode.annotations.description : null;

  const has$Ref = isRefNode(schemaNode) || (getPrimaryType(schemaNode) === SchemaKind.Array && hasRefItems(schemaNode));

  const chosenPropertyIndex = schemaTree.state.getChoiceForNode(node.id);

  const items = getCombinerOptions(node);

  return (
    <>
      {has$Ref || (isParentNode(node) && Tree.getLevel(node) > 0) ? (
        <Caret
          isExpanded={!!rowOptions.isExpanded}
          style={{
            width: ICON_DIMENSION,
            height: ICON_DIMENSION,
            ...(has$Ref && Tree.getLevel(node) === 0
              ? {
                  position: 'relative',
                }
              : {
                  left: ICON_DIMENSION * -1 + ROW_OFFSET / -2,
                }),
          }}
          size={ICON_SIZE}
        />
      ) : null}

      {node.parent !== null &&
        node.parent.children.length > 0 &&
        parentSchemaNode !== null &&
        'combiner' in parentSchemaNode &&
        node.parent.children[0] !== node && <Divider kind={parentSchemaNode.combiner} />}

      <div className="flex-1 flex truncate">
        <Property node={node} onGoToRef={onGoToRef} />
        {node.metadata &&
            <div onClick={e => e.stopPropagation()}>
            <NodesSelect
              items={items}
              filterable={false}
              itemRenderer={(item, { handleClick }) => 
                <div style={{padding: 10, cursor: 'pointer'}} onClick={handleClick}>{item.type}</div>}
              onItemSelect={(item, e) => {
                e?.preventDefault();
                const index = items.indexOf(item);
                schemaTree.state.setChoiceForNode(node.id, index);
                schemaTree.populateCombiner(addChildrenToTreeListNode(node), item, path.concat(index), false)
              }}
            >
              <Button
                text={items[chosenPropertyIndex].type} 
                rightIcon="double-caret-vertical"
              />
            </NodesSelect>
            </div>
        }
        {description && <Description value={description} />}
      </div>
      <Validations
        required={isRequired(node)}
        validations={{
          ...('annotations' in schemaNode &&
            schemaNode.annotations.default && { default: schemaNode.annotations.default }),
          ...('validations' in schemaNode && schemaNode.validations),
        }}
      />
    </>
  );
});
SchemaPropertyRow.displayName = 'JsonSchemaViewer.SchemaPropertyRow';

export const SchemaErrorRow: React.FunctionComponent<{ message: string }> = ({ message }) => (
  <span className="text-red-5 dark:text-red-4">{message}</span>
);
SchemaErrorRow.displayName = 'JsonSchemaViewer.SchemaErrorRow';

export const SchemaRow: React.FunctionComponent<ISchemaRow> = ({ className, node, rowOptions, onGoToRef, schemaTree }) => {
  const metadata = getNodeMetadata(node);

  return (
    <div className={cn('px-2 flex-1 w-full max-w-full', className)}>
      <div
        className="flex items-center text-sm relative"
        style={{
          marginLeft: ICON_DIMENSION * Tree.getLevel(node), // offset for spacing
        }}
      >
        {'schema' in metadata ? (
          <SchemaPropertyRow node={node} onGoToRef={onGoToRef} rowOptions={rowOptions} schemaTree={schemaTree} />
        ) : (
          <SchemaErrorRow message={metadata.error} />
        )}
      </div>
    </div>
  );
};
SchemaRow.displayName = 'JsonSchemaViewer.SchemaRow';
