import type { DirectoryConnection } from '../../domain/model/DirectoryConnection';
import type { DirectoryPage } from './DirectoryProvider';
import type { StagedSubject } from './DirectoryRepository';
export interface DirectoryMapper {
  map(connection: DirectoryConnection, page: DirectoryPage): readonly StagedSubject[];
}
