import {
  Component,
  Input,
  OnInit,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { I18nFacade } from '@dua-upd/upd/state';
import { TreeNode } from 'primeng/api';
import { Table } from 'primeng/table';
import { TreeSelect } from 'primeng/treeselect';

interface SelectedNode {
  header: string;
  label: string;
  value: string;
}[];

@Component({
  selector: 'upd-filter-table',
  templateUrl: './filter-table.component.html',
  styleUrls: ['./filter-table.component.scss'],
})
export class FilterTableComponent implements OnInit {
  @Input() cols: any[] = [];
  @Input() data: any[] = [];
  @Input() table!: Table;
  @ViewChild('treeSelect') treeSelect!: TreeSelect;

  nodes: TreeNode[] = [];
  selectedNodes: SelectedNode[] = [];
  groupedNodes: { [key: string]: SelectedNode[] } = {};

  constructor(
    private i18n: I18nFacade
  ) {}

  ngOnInit() {
  }
  
  ngOnChanges(changes: SimpleChanges) {
    if (changes['data']) {
        this.nodes = this.createNodes(this.data);
      //this.updateNodeLabels(this.data);
    }
  }

  private createNodes(data: TreeNode[]): TreeNode[] {
    const map = new Map();
    const nodes: TreeNode[] = [];

    data.forEach((item) => {
      Object.entries(item).forEach(([key, value]) => {
        if (!map.has(key)) {
          map.set(key, new Set());
        }

        if (Array.isArray(value)) {
          value.forEach((v) => map.get(key).add(v));
        } else {
          map.get(key).add(value);
        }
      });
    });

    map.forEach((value, key) => {
      const header = this.cols.find((col) => col.field === key)?.header || key;
      nodes.push({
        label: header,
        data: key,
        children: Array.from(value).map((v) => {
          return {
            label: v,
            data: key,
          };
        }) as TreeNode[],
      });
    });

    return nodes;
  }

  private handleNodeSelectUnselect(event: { node: TreeNode }, isSelect: boolean) {
    const { label, data } = event.node;
    const parentValue = event.node.parent?.label as string;
  
    if (event.node.children) {
      event.node.children.forEach((child) => {
        const selectedNode = { header: data, label: child.label as string, value: label as string };
  
        if (isSelect) {
          const nodeExists = this.selectedNodes.find(
            node => node.header === selectedNode.header && node.label === selectedNode.label
          );
  
          if (!nodeExists) {
            this.selectedNodes.push(selectedNode);
          }
        } else {
          this.deleteSelectedNode(selectedNode);
        }
      });
    } else {
      const selectedNode = { header: data, label: label as string, value: parentValue };
  
      if (isSelect) {
        const nodeExists = this.selectedNodes.find(
          node => node.header === selectedNode.header && node.label === selectedNode.label
        );
  
        if (!nodeExists) {
          this.selectedNodes.push(selectedNode);
        }
      } else {
        this.deleteSelectedNode(selectedNode);
      }
    }

    this.tableFilter(data);

    console.log(this.selectedNodes)
    console.log(this.table.filters);
    console.log(this.treeSelect)
  }
  
  private deleteSelectedNode(nodeToDelete: SelectedNode) {
    this.selectedNodes = this.selectedNodes.filter((selectedNode) => {
      return selectedNode.header !== nodeToDelete.header ||
             selectedNode.label !== nodeToDelete.label ||
             selectedNode.value !== nodeToDelete.value;
    });
  }
  
  onNodeSelect(event: { node: TreeNode }) {
    this.handleNodeSelectUnselect(event, true);
  }

  onNodeUnselect(event: { node: TreeNode }) {
    this.handleNodeSelectUnselect(event, false);
  }

  clearNodes() {
    this.nodes.forEach((node) => {
      node.expanded = false;
      node.partialSelected = false;
    });
    this.treeSelect.value = [];
    this.selectedNodes = [];
    this.table?.clear();
  }

  deleteFilter(node: SelectedNode) {
    this.selectedNodes = this.selectedNodes.filter(
      (n) => n.header !== node.header || n.label !== node.label
    );

    this.treeSelect.value = this.treeSelect.value.filter(
      (n: { data: string; label: string }) =>
        n.data !== node.header || n.label !== node.label
    );
    
    this.tableFilter(node.header);
  }

  private tableFilter(header: string) {
    const filteredData = this.selectedNodes
      .filter((node) => node.header === header)
      .map((node) => node.label);

    this.table?.filter(filteredData, header, 'in');

    this.table.filters[header] = [
      {
        value: filteredData.length === 0 ? null : filteredData,
        matchMode: 'in',
        operator: 'and',
      },
    ];
  }

  get nodeSelectionCount() {
    return this.selectedNodes.length;
  }
}
