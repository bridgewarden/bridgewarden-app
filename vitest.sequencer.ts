import { BaseSequencer, type TestSpecification } from 'vitest/node';

export default class PathSequencer extends BaseSequencer {
  override async sort(files: TestSpecification[]) {
    return [...files].sort((left, right) => left.moduleId.localeCompare(right.moduleId));
  }
}
