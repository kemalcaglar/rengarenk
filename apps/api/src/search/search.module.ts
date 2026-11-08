import { Module } from '@nestjs/common';
import { DemandSearchService } from './demand-search.service.js';

/** Talep araması (OpenSearch). API listeyi okur, işçi indeksi günceller. */
@Module({ providers: [DemandSearchService], exports: [DemandSearchService] })
export class SearchModule {}
