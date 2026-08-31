import {streamActiveSearchDocuments} from '../src/modules/search/projection';
import {configuredSearchGateway} from '../src/modules/search/search-service';
import {getDatabase} from '../src/server/db/client';
import {logger} from '../src/server/logging/logger';

const count = await configuredSearchGateway().rebuild(streamActiveSearchDocuments(getDatabase()));
logger.info({count}, 'Search index rebuild completed');
