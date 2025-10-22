declare module 'markdown-it-task-lists' {
  import MarkdownIt from 'markdown-it';

  interface TaskListsOptions {
    enabled?: boolean;
    label?: boolean;
    labelAfter?: boolean;
  }

  function taskLists(md: MarkdownIt, options?: TaskListsOptions): void;

  export = taskLists;
}
