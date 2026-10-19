// Porta de persistência (persistencia-sqlite.md §12–§13). A aplicação prepara o candidato fora da
// transação; o Storage Worker aplica um lote tipado de mutações numa única transação BEGIN IMMEDIATE,
// com CAS de revisão/epoch, idempotência por command_id e recibo. Nunca há SQL vindo da UI.

export type CommandType =
  | 'CREATE_PROFILE_ONBOARDING' | 'CONFIRM_DECK' | 'ARCHIVE_DECK' | 'START_ATTEMPT' | 'SUBMIT_BATTLE_ACTION'
  | 'SUSPEND_ATTEMPT' | 'ABANDON_ATTEMPT' | 'FINISH_ATTEMPT' | 'BUY_PRODUCT' | 'OPEN_PACK' | 'CLAIM_DISCOVERY'
  | 'CLAIM_PENDING_REWARD' | 'SAVE_COSMETIC_PRESET' | 'APPLY_APPEARANCE' | 'BUY_COSMETIC' | 'PUBLISH_CARD'
  | 'GRANT_CUSTOM_COPIES' | 'ARCHIVE_ENTITY' | 'SAVE_BINDER' | 'IMPORT_PROFILE' | 'ARCHIVE_PROFILE';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type DeckEntryRow = { readonly entryNo: number; readonly printingId: string; readonly entryFlairId: string | null };

export type Mutation =
  | { readonly kind: 'INSERT_PROFILE'; readonly displayName: string; readonly progressionMode: 'STANDARD' | 'CUSTOM' | 'LAB'; readonly rngJson: JsonValue }
  | { readonly kind: 'SET_PROFILE_RNG'; readonly rngJson: JsonValue }
  | { readonly kind: 'SET_PROFILE_ARCHIVED'; readonly archived: boolean }
  | { readonly kind: 'WALLET_DELTA'; readonly resourceId: string; readonly delta: number }
  | { readonly kind: 'INVENTORY_DELTA'; readonly printingId: string; readonly delta: number }
  | { readonly kind: 'INSERT_DECK'; readonly deckId: string; readonly name: string }
  | { readonly kind: 'INSERT_DECK_VERSION'; readonly deckId: string; readonly revision: number; readonly expectedHead: number; readonly status: 'DRAFT' | 'CONFIRMED'; readonly energyTypes: readonly string[]; readonly validation: JsonValue; readonly entries: readonly DeckEntryRow[]; readonly name?: string }
  | { readonly kind: 'SET_DECK_ARCHIVED'; readonly deckId: string; readonly archived: boolean }
  | { readonly kind: 'UPSERT_CAMPAIGN_PROGRESS'; readonly campaignId: string; readonly nodeId: string; readonly campaignVersion: string; readonly status: 'LOCKED' | 'AVAILABLE' | 'CLEARED'; readonly progress: JsonValue }
  | {
    readonly kind: 'INSERT_ATTEMPT'; readonly attemptId: string; readonly mode: 'CAMPAIGN' | 'ARENA' | 'TRAINING' | 'CUSTOM' | 'LAB';
    readonly campaignId: string | null; readonly nodeId: string | null; readonly difficulty: 'STORY' | 'STANDARD' | 'EXPERT' | null;
    readonly deckId: string | null; readonly deckRevision: number | null; readonly progressionEligible: boolean;
    readonly stateVersion: number; readonly rulesetId: string; readonly engineVersion: string; readonly contentFingerprint: string;
    readonly state: JsonValue; readonly rng: JsonValue; readonly presentationSnapshot: JsonValue;
    readonly cardRefs: readonly string[]; readonly assetRefs: readonly string[];
  }
  | {
    readonly kind: 'UPDATE_ATTEMPT'; readonly attemptId: string; readonly expectedStateVersion: number; readonly stateVersion: number;
    readonly status: 'RUNNING' | 'SUSPENDED' | 'FINISHED' | 'ABANDONED'; readonly state: JsonValue; readonly rng: JsonValue; readonly result: JsonValue | null;
  }
  | { readonly kind: 'INSERT_BATTLE_EVENTS'; readonly attemptId: string; readonly stateVersion: number; readonly events: readonly { readonly seq: number; readonly type: string; readonly event: JsonValue }[] }
  | { readonly kind: 'INSERT_CHECKPOINT'; readonly attemptId: string; readonly stateVersion: number; readonly lastEventSequence: number; readonly snapshot: JsonValue; readonly snapshotHash: string }
  | { readonly kind: 'INSERT_REPLAY'; readonly replayId: string; readonly attemptId: string; readonly metadata: JsonValue }
  | { readonly kind: 'INSERT_PENDING_REWARD'; readonly rewardId: string; readonly grantKey: string; readonly options: JsonValue; readonly sourceAttemptId: string | null }
  | { readonly kind: 'CLAIM_PENDING_REWARD'; readonly rewardId: string; readonly choice: JsonValue }
  | { readonly kind: 'GRANT_ENTITLEMENT'; readonly cosmeticId: string; readonly origin: 'ONBOARDING' | 'PURCHASE' | 'MILESTONE' | 'CUSTOM_GRANT' }
  | { readonly kind: 'INSERT_COSMETIC_PRESET'; readonly presetId: string; readonly revision: number; readonly config: JsonValue; readonly assetIds: readonly string[] }
  | { readonly kind: 'SET_PROFILE_APPEARANCE'; readonly presetId: string; readonly presetRevision: number }
  | { readonly kind: 'SET_DECK_APPEARANCE'; readonly deckId: string; readonly mode: 'INHERIT_PROFILE' | 'OVERRIDE'; readonly presetId: string | null; readonly presetRevision: number | null }
  | { readonly kind: 'UPSERT_BINDER'; readonly binderId: string; readonly name: string; readonly binderKind: 'BINDER' | 'SHOWCASE'; readonly layout: JsonValue; readonly sortOrder: number; readonly slots: readonly { readonly pageNo: number; readonly slotNo: number; readonly printingId: string }[] }
  | { readonly kind: 'INSERT_ASSET_BLOB'; readonly assetId: string; readonly mediaType: string; readonly bytes: Uint8Array; readonly width: number | null; readonly height: number | null; readonly metadata: JsonValue }
  | { readonly kind: 'INSERT_CARD_DEFINITION'; readonly definitionId: string; readonly namespace: 'BASE' | 'CUSTOM' }
  | { readonly kind: 'INSERT_CARD_VERSION'; readonly definitionId: string; readonly version: number; readonly rules: JsonValue; readonly rulesHash: string; readonly rulesetId: string; readonly searchKey: string }
  | { readonly kind: 'INSERT_PUBLICATION'; readonly definitionId: string; readonly version: number; readonly validatorVersion: string; readonly report: JsonValue; readonly projectId: string | null; readonly projectRevision: number | null }
  | { readonly kind: 'SET_CATALOG_HEAD'; readonly definitionId: string; readonly version: number }
  | { readonly kind: 'INSERT_CARD_DEPENDENCY'; readonly definitionId: string; readonly version: number; readonly dependencyId: string; readonly dependencyVersion: number; readonly dependencyKind: 'COPY_ATTACK' | 'REFERENCE' | 'TEST_FIXTURE' }
  | { readonly kind: 'INSERT_PRINTING'; readonly printingId: string; readonly definitionId: string; readonly definitionVersion: number; readonly appearance: JsonValue; readonly appearanceHash: string }
  | { readonly kind: 'INSERT_EDITOR_REVISION_PUBLISHED'; readonly projectId: string; readonly revision: number; readonly draft: JsonValue; readonly validationSummary: JsonValue; readonly assetRefs: readonly { readonly role: string; readonly assetId: string }[] }
  /** `archived: false` remove a marca (desarquivar, persistencia §11); ausente = arquivar. */
  | { readonly kind: 'ARCHIVE_MARK'; readonly entityKind: 'VERSION' | 'PRINTING'; readonly entityId: string; readonly entityVersion: number; readonly archived?: boolean }
  | { readonly kind: 'INSERT_PROFILE_IMPORT'; readonly importId: string; readonly sourceKind: 'PROFILE_ZIP_4' | 'DATABASE_BACKUP'; readonly sourceFingerprint: string; readonly report: JsonValue }
  /** SAVE_COSMETIC_PRESET remove o rascunho da oficina aplicado no mesmo COMMIT (persistencia §13.1). */
  | { readonly kind: 'DELETE_APPEARANCE_DRAFT'; readonly contextId: string }
  /** ARCHIVE_ENTITY de fichário e de definição inteira (persistencia §11). */
  | { readonly kind: 'SET_BINDER_ARCHIVED'; readonly binderId: string; readonly archived: boolean }
  | { readonly kind: 'SET_DEFINITION_ARCHIVED'; readonly definitionId: string; readonly archived: boolean }
  /**
   * IMPORT_PROFILE (persistencia §24.1/§25): todas as linhas de um perfil portátil, já validadas e com IDs locais
   * remapeados, mais o conteúdo CUSTOM/BLOB alcançável. Vem logo depois de INSERT_PROFILE. As operações históricas
   * ocupam as revisões 1..N do perfil novo; a própria operação IMPORT_PROFILE é N+1 (expectedRevision = N).
   */
  | { readonly kind: 'IMPORT_PROFILE_ROWS'; readonly rows: ProfileRowsV4; readonly content: PortableContent };

export type Receipt = {
  readonly commandType: CommandType;
  readonly summary: JsonValue;
  readonly grants: readonly string[];
  readonly events?: { readonly first: number; readonly last: number } | null;
};

export type CommitRequest = {
  readonly commandId: string;
  readonly profileId: string;
  readonly commandType: CommandType;
  readonly payloadHash: string;
  /** Revisão esperada do perfil; 0 para CREATE_PROFILE_ONBOARDING (perfil ainda inexistente). */
  readonly expectedRevision: number;
  readonly writerEpoch: number;
  readonly mutations: readonly Mutation[];
  readonly grantKeys: readonly string[];
  readonly receipt: Receipt;
  readonly committedAt: string;
};

export type CommitOk = {
  readonly ok: true;
  readonly status: 'COMMITTED' | 'REPLAYED';
  readonly operationId: string;
  readonly committedRevision: number;
  readonly receipt: Receipt;
  /** GRANT_ENTITLEMENT não-PURCHASE já possuídos (INSERT OR IGNORE); ausente em REPLAYED. */
  readonly ignoredEntitlements?: readonly string[];
};

export type StorageErrorCode =
  | 'REVISION_CONFLICT' | 'COMMAND_PAYLOAD_MISMATCH' | 'REWARD_ALREADY_GRANTED' | 'INSUFFICIENT_CREDITS' | 'ACTIVE_ATTEMPT_EXISTS'
  | 'STATE_VERSION_MISMATCH' | 'STORAGE_FULL' | 'DATABASE_CORRUPT' | 'CONTENT_REFERENCE_MISSING' | 'INTERNAL_INTEGRITY_ERROR'
  | 'SAVE_WRITE_FAILED' | 'STORAGE_CAPABILITY_MISSING' | 'ORIGIN_ISOLATION_REQUIRED' | 'DATABASE_IN_USE' | 'SQLITE_RUNTIME_MISSING'
  | 'MIGRATION_FAILED' | 'SAVE_VERSION_UNSUPPORTED' | 'IMPORT_INVALID' | 'NOT_FOUND';

export type StorageError = { readonly ok: false; readonly code: StorageErrorCode; readonly message: string };

/**
 * Escritas leves sem `operations` (persistencia §13.1): CAS próprio por head/revisão.
 * `writerEpoch` opcional: quando presente, é conferido contra `profiles.writer_epoch` do perfil dono
 * (persistencia §12.1/§19); divergência = REVISION_CONFLICT sem gravar nada.
 */
export type LightWrite =
  | { readonly kind: 'SAVE_DECK_DRAFT'; readonly profileId: string; readonly deckId: string; readonly name: string; readonly expectedHead: number; readonly revision: number; readonly energyTypes: readonly string[]; readonly validation: JsonValue; readonly entries: readonly DeckEntryRow[]; readonly createIfMissing: boolean; readonly writerEpoch?: number }
  | { readonly kind: 'CREATE_EDITOR_PROJECT'; readonly profileId: string; readonly projectId: string; readonly title: string; readonly mode: 'NEW_DEFINITION' | 'NEW_VERSION' | 'VARIANT' | 'FORK'; readonly targetDefinitionId: string | null; readonly sourceDefinitionId: string | null; readonly sourceVersion: number | null; readonly writerEpoch?: number }
  | { readonly kind: 'SAVE_EDITOR_REVISION'; readonly projectId: string; readonly expectedHead: number; readonly revision: number; readonly revisionKind: 'AUTO' | 'MANUAL'; readonly draft: JsonValue; readonly validationSummary: JsonValue; readonly assetRefs: readonly { readonly role: string; readonly assetId: string }[]; readonly keepAutoRevisions: number; readonly writerEpoch?: number }
  | { readonly kind: 'SET_PROJECT_STATUS'; readonly projectId: string; readonly status: 'DRAFT' | 'ARCHIVED'; readonly writerEpoch?: number }
  | { readonly kind: 'INSERT_TEST_RUN'; readonly runId: string; readonly projectId: string; readonly revision: number; readonly runnerVersion: string; readonly rulesHash: string; readonly scenario: JsonValue; readonly result: JsonValue; readonly outcome: 'PASS' | 'FAIL' | 'ERROR' }
  | { readonly kind: 'INSERT_ASSET_BLOB'; readonly assetId: string; readonly mediaType: string; readonly bytes: Uint8Array; readonly width: number | null; readonly height: number | null; readonly metadata: JsonValue }
  | { readonly kind: 'MARK_COLLECTION'; readonly profileId: string; readonly markKind: 'FAVORITE' | 'WISHLIST' | 'SEEN'; readonly subjectKind: 'PRINTING' | 'DEFINITION'; readonly subjectId: string; readonly on: boolean; readonly writerEpoch?: number }
  | { readonly kind: 'SET_SETTINGS'; readonly profileId: string; readonly values: Readonly<Record<string, JsonValue>>; readonly writerEpoch?: number }
  | { readonly kind: 'SAVE_APPEARANCE_DRAFT'; readonly profileId: string; readonly contextId: string; readonly revision: number; readonly draft: JsonValue; readonly assetIds: readonly string[]; readonly writerEpoch?: number }
  | { readonly kind: 'SET_APP_META'; readonly key: string; readonly value: JsonValue };

export type WriteOk = { readonly ok: true; readonly head?: number };

// ---- consultas

export type ProfileRow = {
  readonly profileId: string; readonly displayName: string; readonly progressionMode: 'STANDARD' | 'CUSTOM' | 'LAB';
  readonly revision: number; readonly writerEpoch: number; readonly rng: JsonValue; readonly createdAt: string; readonly updatedAt: string; readonly archived: boolean;
};

export type DeckRow = {
  readonly deckId: string; readonly name: string; readonly headRevision: number; readonly archived: boolean; readonly createdAt: string;
  readonly status: 'DRAFT' | 'CONFIRMED' | null; readonly energyTypes: readonly string[]; readonly validation: JsonValue; readonly entries: readonly DeckEntryRow[];
  readonly lastConfirmedRevision: number | null;
  /** Última versão CONFIRMED (usada em duelos), mesmo quando a head é um rascunho mais novo. */
  readonly confirmed: { readonly revision: number; readonly energyTypes: readonly string[]; readonly entries: readonly DeckEntryRow[] } | null;
  readonly appearance: { readonly mode: 'INHERIT_PROFILE' | 'OVERRIDE'; readonly presetId: string | null; readonly presetRevision: number | null } | null;
};

export type AttemptRow = {
  readonly attemptId: string; readonly profileId: string; readonly mode: string; readonly status: 'RUNNING' | 'SUSPENDED' | 'FINISHED' | 'ABANDONED';
  readonly campaignId: string | null; readonly nodeId: string | null; readonly difficulty: string | null; readonly deckId: string | null; readonly deckRevision: number | null;
  readonly progressionEligible: boolean; readonly stateVersion: number; readonly rulesetId: string; readonly engineVersion: string; readonly contentFingerprint: string;
  readonly state: JsonValue; readonly rng: JsonValue; readonly presentationSnapshot: JsonValue; readonly result: JsonValue | null; readonly createdAt: string; readonly updatedAt: string;
};

export type ProfileSnapshot = {
  readonly profile: ProfileRow;
  readonly wallets: Readonly<Record<string, number>>;
  readonly inventory: readonly { readonly printingId: string; readonly quantity: number }[];
  readonly decks: readonly DeckRow[];
  readonly campaignProgress: readonly { readonly campaignId: string; readonly nodeId: string; readonly campaignVersion: string; readonly status: 'LOCKED' | 'AVAILABLE' | 'CLEARED'; readonly progress: JsonValue; readonly updatedAt: string }[];
  readonly entitlements: readonly { readonly cosmeticId: string; readonly origin: string; readonly acquiredAt: string }[];
  readonly pendingRewards: readonly { readonly rewardId: string; readonly grantKey: string; readonly status: 'PENDING' | 'CLAIMED'; readonly options: JsonValue; readonly choice: JsonValue | null; readonly createdAt: string }[];
  readonly grants: readonly string[];
  readonly settings: Readonly<Record<string, JsonValue>>;
  readonly activeAttempt: Omit<AttemptRow, 'state' | 'rng'> | null;
  readonly appearance: { readonly presetId: string; readonly presetRevision: number; readonly config: JsonValue } | null;
  readonly presets: readonly { readonly presetId: string; readonly revision: number; readonly config: JsonValue; readonly createdAt: string }[];
  readonly binders: readonly { readonly binderId: string; readonly name: string; readonly kind: 'BINDER' | 'SHOWCASE'; readonly layout: JsonValue; readonly sortOrder: number; readonly slots: readonly { readonly pageNo: number; readonly slotNo: number; readonly printingId: string }[] }[];
  readonly marks: readonly { readonly markKind: 'FAVORITE' | 'WISHLIST' | 'SEEN'; readonly subjectKind: 'PRINTING' | 'DEFINITION'; readonly subjectId: string }[];
};

export type Query =
  | { readonly kind: 'LIST_PROFILES'; readonly includeArchived: boolean }
  | { readonly kind: 'PROFILE_SNAPSHOT'; readonly profileId: string }
  | { readonly kind: 'GET_ATTEMPT'; readonly attemptId: string }
  | { readonly kind: 'LIST_ATTEMPTS'; readonly profileId: string; readonly limit: number; readonly offset: number }
  | { readonly kind: 'GET_EVENTS'; readonly attemptId: string; readonly fromSeq: number }
  | { readonly kind: 'GET_CHECKPOINTS'; readonly attemptId: string }
  /** Snapshot completo de um checkpoint (replay S39, retomada). */
  | { readonly kind: 'GET_CHECKPOINT'; readonly attemptId: string; readonly stateVersion: number }
  | { readonly kind: 'GET_OPERATION'; readonly profileId: string; readonly commandId: string }
  | { readonly kind: 'LIST_RECEIPTS'; readonly profileId: string; readonly limit: number; readonly offset: number }
  | { readonly kind: 'CUSTOM_CATALOG'; readonly profileId: string | null }
  | { readonly kind: 'LIST_PROJECTS'; readonly profileId: string; readonly includeArchived: boolean }
  | { readonly kind: 'GET_PROJECT'; readonly projectId: string; readonly revision: number | null }
  | { readonly kind: 'LIST_TEST_RUNS'; readonly projectId: string }
  | { readonly kind: 'GET_ASSET'; readonly assetId: string }
  | { readonly kind: 'CONTENT_INSTALLED'; readonly packageId: string; readonly version: string }
  | { readonly kind: 'APP_META'; readonly key: string }
  /** Rascunho da oficina de aparência (persistencia §13.1). */
  | { readonly kind: 'GET_APPEARANCE_DRAFT'; readonly profileId: string; readonly contextId: string }
  | { readonly kind: 'DIAGNOSTICS'; readonly deep: boolean }
  /** Todas as linhas de um perfil + conteúdo CUSTOM/BLOB alcançável, numa leitura única (persistencia §24.1). */
  | { readonly kind: 'PROFILE_EXPORT'; readonly profileId: string }
  /** Linhas de `content_packages` (backup §23 `requiredContentPackages`; pré-importação). */
  | { readonly kind: 'LIST_CONTENT_PACKAGES' }
  /** Pré-checagem de uma importação: conflitos de ID+hash, referências ausentes e importações anteriores do mesmo arquivo. */
  | { readonly kind: 'IMPORT_PREFLIGHT'; readonly check: ImportPreflightInput };

export type QueryResultMap = {
  LIST_PROFILES: readonly ProfileRow[];
  PROFILE_SNAPSHOT: ProfileSnapshot | null;
  GET_ATTEMPT: AttemptRow | null;
  LIST_ATTEMPTS: readonly Omit<AttemptRow, 'state' | 'rng'>[];
  GET_EVENTS: readonly { readonly seq: number; readonly type: string; readonly stateVersion: number; readonly event: JsonValue }[];
  GET_CHECKPOINTS: readonly { readonly stateVersion: number; readonly lastEventSequence: number; readonly snapshotHash: string; readonly createdAt: string }[];
  GET_CHECKPOINT: { readonly stateVersion: number; readonly lastEventSequence: number; readonly snapshot: JsonValue; readonly snapshotHash: string } | null;
  GET_OPERATION: { readonly operationId: string; readonly payloadHash: string; readonly committedRevision: number; readonly receipt: Receipt } | null;
  LIST_RECEIPTS: readonly { readonly operationId: string; readonly commandId: string; readonly commandType: string; readonly committedRevision: number; readonly receipt: Receipt; readonly committedAt: string }[];
  CUSTOM_CATALOG: { readonly versions: readonly { readonly definitionId: string; readonly version: number; readonly rules: JsonValue; readonly ownerProfileId: string | null; readonly archived: boolean }[]; readonly printings: readonly { readonly printingId: string; readonly appearance: JsonValue; readonly archived: boolean }[]; readonly heads: Readonly<Record<string, number>> };
  LIST_PROJECTS: readonly { readonly projectId: string; readonly title: string; readonly mode: string; readonly status: 'DRAFT' | 'ARCHIVED'; readonly headRevision: number; readonly targetDefinitionId: string | null; readonly updatedAt: string; readonly validationSummary: JsonValue }[];
  GET_PROJECT: { readonly projectId: string; readonly profileId: string; readonly title: string; readonly mode: string; readonly status: string; readonly headRevision: number; readonly targetDefinitionId: string | null; readonly sourceDefinitionId: string | null; readonly sourceVersion: number | null; readonly revision: number; readonly revisionKind: string; readonly draft: JsonValue; readonly validationSummary: JsonValue; readonly revisions: readonly { readonly revision: number; readonly kind: string; readonly createdAt: string }[] } | null;
  LIST_TEST_RUNS: readonly { readonly runId: string; readonly revision: number; readonly rulesHash: string; readonly scenario: JsonValue; readonly result: JsonValue; readonly outcome: string; readonly createdAt: string }[];
  GET_ASSET: { readonly assetId: string; readonly mediaType: string; readonly bytes: Uint8Array; readonly width: number | null; readonly height: number | null; readonly metadata: JsonValue } | null;
  CONTENT_INSTALLED: boolean;
  APP_META: JsonValue | null;
  GET_APPEARANCE_DRAFT: { readonly revision: number; readonly draft: JsonValue } | null;
  DIAGNOSTICS: { readonly sqliteVersion: string; readonly userVersion: number; readonly applicationId: number; readonly journalMode: string; readonly foreignKeys: boolean; readonly quickCheck: string; readonly integrityCheck: string | null; readonly foreignKeyViolations: number | null; readonly tables: number; readonly vfs: string; readonly pageCount: number; readonly pageSize: number };
  PROFILE_EXPORT: ProfileExportData | null;
  LIST_CONTENT_PACKAGES: readonly (ContentPackageRef & { readonly origin: 'BASE' | 'CUSTOM'; readonly installedAt: string })[];
  IMPORT_PREFLIGHT: ImportPreflightResult;
};

export type QueryResult<Q extends Query> = QueryResultMap[Q['kind']];

export type ContentInstall = {
  readonly packageId: string;
  readonly version: string;
  readonly contentHash: string;
  readonly manifest: JsonValue;
  /** `card_versions.ruleset_id` (NOT NULL). Ausente: `manifest.rulesetId` quando string, senão 'local-campaign-v2'. */
  readonly rulesetId?: string;
  readonly definitions: readonly { readonly definitionId: string; readonly version: number; readonly rules: JsonValue; readonly rulesHash: string; readonly searchKey: string }[];
  readonly printings: readonly { readonly printingId: string; readonly definitionId: string; readonly definitionVersion: number; readonly appearance: JsonValue; readonly appearanceHash: string }[];
};

export type StoragePort = {
  readonly query: <Q extends Query>(q: Q) => Promise<QueryResult<Q>>;
  readonly commit: (request: CommitRequest) => Promise<CommitOk | StorageError>;
  readonly write: (write: LightWrite) => Promise<WriteOk | StorageError>;
  /** Instala o pacote BASE de forma idempotente (por hash) — definições, versões, publicações, heads, impressões. */
  readonly installContent: (install: ContentInstall) => Promise<{ readonly ok: true; readonly installed: boolean } | StorageError>;
  /** Incrementa e devolve o epoch de escrita do perfil (troca de aba/perfil invalida jobs antigos). */
  readonly bumpWriterEpoch: (profileId: string) => Promise<number>;
  readonly exportDatabase: () => Promise<Uint8Array>;
  readonly close: () => Promise<void>;
  /**
   * Restauração completa (persistencia §25.1), só no navegador (OPFS): fecha a conexão principal, guarda o banco
   * atual em /card-campaign/backups/, move o staging validado para /card-campaign/main.sqlite3 e reabre pelo boot
   * normal; qualquer falha devolve o arquivo anterior antes de reabrir. Ausente nos adaptadores sem OPFS.
   */
  readonly restoreFromStaging?: (request: RestoreSwapRequest) => Promise<RestoreSwapOk | StorageError>;
  /**
   * “Apagar todos os dados locais” (persistencia §11, interface §31.6): fecha a conexão, remove /card-campaign do
   * OPFS e libera o Web Lock. Depois disso a porta fica fechada; a aplicação deve recarregar.
   */
  readonly wipeAllData?: () => Promise<{ readonly ok: true } | StorageError>;
};

// ---------------------------------------------------------------------------------------------------------
// Perfil portátil, backup e importação (persistencia §23–§25). Adições desta linha:
// - Query PROFILE_EXPORT / LIST_CONTENT_PACKAGES / IMPORT_PREFLIGHT;
// - Mutation IMPORT_PROFILE_ROWS (só dentro do commit IMPORT_PROFILE).
// Referências a operações do próprio perfil usam a revisão confirmada (`operationRevision`): o operation_id é
// derivado do perfil pelo Storage Worker, de modo que remapear o perfil remapeia as operações.

export type ContentPackageRef = { readonly packageId: string; readonly version: string; readonly contentHash: string };

export type PortableDeck = {
  readonly deckId: string; readonly name: string; readonly headRevision: number; readonly archived: boolean; readonly createdAt: string;
  readonly versions: readonly {
    readonly revision: number; readonly status: 'DRAFT' | 'CONFIRMED'; readonly energyTypes: JsonValue; readonly validation: JsonValue;
    readonly createdAt: string; readonly entries: readonly DeckEntryRow[];
  }[];
};

export type PortableAttempt = {
  readonly attemptId: string; readonly mode: 'CAMPAIGN' | 'ARENA' | 'TRAINING' | 'CUSTOM' | 'LAB'; readonly status: 'RUNNING' | 'SUSPENDED' | 'FINISHED' | 'ABANDONED';
  readonly campaignId: string | null; readonly nodeId: string | null; readonly difficulty: 'STORY' | 'STANDARD' | 'EXPERT' | null;
  readonly deckId: string | null; readonly deckRevision: number | null; readonly progressionEligible: boolean; readonly stateVersion: number;
  readonly rulesetId: string; readonly engineVersion: string; readonly contentFingerprint: string;
  readonly state: JsonValue; readonly rng: JsonValue; readonly presentationSnapshot: JsonValue; readonly result: JsonValue | null;
  readonly createdAt: string; readonly updatedAt: string;
  readonly cardRefs: readonly string[]; readonly assetRefs: readonly string[];
  readonly events: readonly { readonly seq: number; readonly operationRevision: number; readonly stateVersion: number; readonly type: string; readonly event: JsonValue }[];
  readonly checkpoints: readonly { readonly stateVersion: number; readonly lastEventSequence: number; readonly snapshot: JsonValue; readonly snapshotHash: string; readonly createdAt: string }[];
};

export type PortableProject = {
  readonly projectId: string; readonly title: string; readonly mode: 'NEW_DEFINITION' | 'NEW_VERSION' | 'VARIANT' | 'FORK'; readonly status: 'DRAFT' | 'ARCHIVED';
  readonly headRevision: number; readonly targetDefinitionId: string | null; readonly sourceDefinitionId: string | null; readonly sourceVersion: number | null;
  readonly createdAt: string; readonly updatedAt: string;
  readonly revisions: readonly {
    readonly revision: number; readonly kind: 'AUTO' | 'MANUAL' | 'PUBLISHED'; readonly draft: JsonValue; readonly validationSummary: JsonValue; readonly createdAt: string;
    readonly assetRefs: readonly { readonly role: string; readonly assetId: string }[];
  }[];
  readonly testRuns: readonly {
    readonly runId: string; readonly revision: number; readonly runnerVersion: string; readonly rulesHash: string; readonly scenario: JsonValue;
    readonly result: JsonValue; readonly outcome: 'PASS' | 'FAIL' | 'ERROR'; readonly createdAt: string;
  }[];
};

/** Linhas de um perfil (sem writer_epoch), com IDs locais do arquivo de origem ou já remapeados para a importação. */
export type ProfileRowsV4 = {
  readonly profile: {
    readonly displayName: string; readonly progressionMode: 'STANDARD' | 'CUSTOM' | 'LAB'; readonly revision: number; readonly rng: JsonValue;
    readonly createdAt: string; readonly updatedAt: string; readonly archived: boolean;
  };
  readonly settings: readonly { readonly key: string; readonly value: JsonValue }[];
  readonly operations: readonly {
    readonly committedRevision: number; readonly commandId: string; readonly commandType: string; readonly payloadHash: string;
    readonly receipt: JsonValue; readonly committedAt: string;
  }[];
  readonly wallets: readonly { readonly resourceId: string; readonly balance: number }[];
  readonly walletEntries: readonly { readonly operationRevision: number; readonly entryNo: number; readonly resourceId: string; readonly delta: number; readonly balanceAfter: number }[];
  readonly inventory: readonly { readonly printingId: string; readonly quantity: number }[];
  readonly inventoryEntries: readonly { readonly operationRevision: number; readonly entryNo: number; readonly printingId: string; readonly delta: number; readonly quantityAfter: number }[];
  readonly rewardGrants: readonly { readonly grantKey: string; readonly operationRevision: number; readonly grantedAt: string }[];
  readonly pendingRewards: readonly {
    readonly rewardId: string; readonly grantKey: string; readonly status: 'PENDING' | 'CLAIMED'; readonly options: JsonValue; readonly choice: JsonValue | null;
    readonly sourceOperationRevision: number; readonly sourceAttemptId: string | null; readonly operationRevision: number | null; readonly createdAt: string;
  }[];
  readonly entitlements: readonly { readonly cosmeticId: string; readonly origin: 'ONBOARDING' | 'PURCHASE' | 'MILESTONE' | 'CUSTOM_GRANT'; readonly operationRevision: number; readonly acquiredAt: string }[];
  readonly decks: readonly PortableDeck[];
  readonly deckAppearance: readonly { readonly deckId: string; readonly mode: 'INHERIT_PROFILE' | 'OVERRIDE'; readonly presetId: string | null; readonly presetRevision: number | null }[];
  readonly profileAppearance: { readonly presetId: string; readonly presetRevision: number } | null;
  readonly campaignProgress: readonly {
    readonly campaignId: string; readonly nodeId: string; readonly campaignVersion: string; readonly status: 'LOCKED' | 'AVAILABLE' | 'CLEARED';
    readonly progress: JsonValue; readonly updatedAt: string;
  }[];
  readonly attempts: readonly PortableAttempt[];
  readonly replays: readonly { readonly replayId: string; readonly attemptId: string; readonly metadata: JsonValue; readonly createdAt: string }[];
  readonly cosmeticPresets: readonly { readonly presetId: string; readonly revision: number; readonly config: JsonValue; readonly createdAt: string; readonly assetIds: readonly string[] }[];
  readonly appearanceDrafts: readonly { readonly contextId: string; readonly revision: number; readonly draft: JsonValue; readonly assetIds: readonly string[] }[];
  readonly binders: readonly {
    readonly binderId: string; readonly name: string; readonly kind: 'BINDER' | 'SHOWCASE'; readonly layout: JsonValue; readonly sortOrder: number;
    readonly archived: boolean; readonly createdAt: string; readonly updatedAt: string;
    readonly slots: readonly { readonly pageNo: number; readonly slotNo: number; readonly printingId: string }[];
  }[];
  readonly collectionMarks: readonly { readonly markKind: 'FAVORITE' | 'WISHLIST' | 'SEEN'; readonly subjectKind: 'PRINTING' | 'DEFINITION'; readonly subjectId: string; readonly createdAt: string }[];
  readonly projects: readonly PortableProject[];
};

export type PortableCardVersion = {
  readonly definitionId: string; readonly version: number; readonly rules: JsonValue; readonly rulesHash: string; readonly rulesetId: string;
  readonly searchKey: string; readonly createdAt: string;
  /** `projectId`/`operationRevision` só quando a publicação pertence ao próprio perfil exportado; senão nulos. */
  readonly publication: {
    readonly validatorVersion: string; readonly report: JsonValue; readonly projectId: string | null; readonly projectRevision: number | null;
    readonly operationRevision: number | null; readonly publishedAt: string;
  } | null;
  readonly dependencies: readonly { readonly dependencyId: string; readonly dependencyVersion: number; readonly dependencyKind: 'COPY_ATTACK' | 'REFERENCE' | 'TEST_FIXTURE' }[];
};

export type PortableAsset = {
  readonly assetId: string; readonly mediaType: string; readonly bytes: Uint8Array; readonly width: number | null; readonly height: number | null;
  readonly metadata: JsonValue; readonly createdAt: string;
};

/** Conteúdo CUSTOM alcançável pelo perfil (definições/versões/impressões) e os BLOBs referenciados. */
export type PortableContent = {
  readonly definitions: readonly { readonly definitionId: string; readonly createdAt: string; readonly archived: boolean }[];
  readonly versions: readonly PortableCardVersion[];
  readonly catalogHeads: readonly { readonly definitionId: string; readonly version: number }[];
  readonly printings: readonly {
    readonly printingId: string; readonly definitionId: string; readonly definitionVersion: number; readonly appearance: JsonValue;
    readonly appearanceHash: string; readonly createdAt: string;
  }[];
  readonly assets: readonly PortableAsset[];
};

export type ProfileExportData = {
  readonly profileId: string;
  readonly userVersion: number;
  readonly sqliteVersion: string;
  /** `app_meta.appVersion` gravado por último (pode faltar em banco antigo). */
  readonly appVersion: string | null;
  readonly rows: ProfileRowsV4;
  readonly content: PortableContent;
  /** Pacotes BASE exigidos: os ativos (`app_meta.contentPackages`) e os que contêm impressões referenciadas. */
  readonly packages: readonly ContentPackageRef[];
  /** Assets referenciados registrados como BUNDLED (sem bytes): dependem do pacote instalado. */
  readonly bundledAssetIds: readonly string[];
};

export type ImportPreflightInput = {
  readonly fingerprint: string;
  readonly definitions: readonly string[];
  readonly versions: readonly { readonly definitionId: string; readonly version: number; readonly rulesHash: string }[];
  readonly printings: readonly { readonly printingId: string; readonly appearanceHash: string }[];
  /** Impressões/versões referenciadas pelo perfil e não incluídas no arquivo: precisam existir no banco. */
  readonly printingRefs: readonly string[];
  readonly versionRefs: readonly { readonly definitionId: string; readonly version: number }[];
  /** Assets referenciados e não incluídos no arquivo. */
  readonly assetRefs: readonly string[];
};

export type ImportPreflightResult = {
  /** Mesmo ID com hash diferente: nunca sobrescrito (DB-047). */
  readonly conflicts: readonly string[];
  readonly missingPrintings: readonly string[];
  readonly missingVersions: readonly string[];
  readonly missingAssets: readonly string[];
  readonly reusedVersions: number;
  readonly reusedPrintings: number;
  readonly previousImports: readonly { readonly importId: string; readonly targetProfileId: string; readonly completedAt: string }[];
};

// ---- restauração de backup completo (persistencia §23, §25.1)

/** Perfil contido num backup inspecionado (resumo exibido antes de restaurar ou importar dele). */
export type BackupProfileSummary = {
  readonly profileId: string; readonly displayName: string; readonly progressionMode: 'STANDARD' | 'CUSTOM' | 'LAB'; readonly archived: boolean;
  readonly revision: number; readonly createdAt: string; readonly updatedAt: string; readonly nodesCleared: number; readonly cardsOwned: number;
  readonly decks: number; readonly activeAttempt: 'RUNNING' | 'SUSPENDED' | null; readonly clearedNodeIds: readonly string[];
};

/** Resultado da validação de um backup num worker descartável (cabeçalho, schema canônico, integridade, staging). */
export type BackupInspection = {
  readonly bytes: number; readonly userVersion: number; readonly applicationId: number; readonly pageSize: number; readonly pageCount: number;
  readonly appVersion: string | null; readonly installationId: string | null;
  readonly tables: number; readonly rows: number;
  readonly profiles: readonly BackupProfileSummary[];
  readonly contentPackages: readonly (ContentPackageRef & { readonly origin: 'BASE' | 'CUSTOM' })[];
  readonly importedAssets: number; readonly importedAssetBytes: number;
  /** Verificações executadas, na ordem, todas aprovadas (integrity_check, foreign_key_check, schema canônico…). */
  readonly checks: readonly string[];
};

export type RestoreSwapRequest = {
  /** Caminho OPFS do staging validado (/card-campaign/staging/<importId>.sqlite3). */
  readonly stagingPath: string;
  /** SHA-256 dos bytes validados: o arquivo trocado precisa ser exatamente o que passou na validação. */
  readonly expectedSha256: string;
};

export type RestoreSwapOk = {
  readonly ok: true;
  /** Banco anterior preservado em /card-campaign/backups/main-<timestamp>.sqlite3 até o usuário descartá-lo. */
  readonly previousPath: string;
  readonly userVersion: number;
};
