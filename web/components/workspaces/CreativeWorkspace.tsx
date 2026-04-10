'use client';

import { useEffect, useState } from 'react';
import StudioContent from '@/components/StudioContent';
import StudioSidebar from '@/components/StudioSidebar';
import { useStudioState } from '@/hooks/useStudioState';

type WorkspaceMode = 'proposal' | 'studio' | 'mining';

export default function CreativeWorkspace() {
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('studio');
  const [industries, setIndustries] = useState<string[]>([]);
  const studio = useStudioState(workspaceMode, setWorkspaceMode, industries);

  useEffect(() => {
    fetch('/api/industries')
      .then(r => r.json())
      .then(d => setIndustries(d.industries || []))
      .catch(() => {});
  }, []);

  const studioSidebar = (
    <StudioSidebar
      formSeed={studio.studioFormSeed}
      advertiserName={studio.studioAdvertiserName}
      onAdvertiserNameChange={studio.setStudioAdvertiserName}
      advertiserIndustry={studio.studioAdvertiserIndustry}
      onAdvertiserIndustryChange={studio.setStudioAdvertiserIndustry}
      campaignName={studio.studioCampaignName}
      onCampaignNameChange={studio.setStudioCampaignName}
      creativeMessage={studio.studioCreativeMessage}
      onCreativeMessageChange={studio.setStudioCreativeMessage}
      notes={studio.studioNotes}
      onNotesChange={studio.setStudioNotes}
      creativeFormat={studio.studioCreativeFormat}
      onCreativeFormatChange={studio.setStudioCreativeFormat}
      creativeAudioMode={studio.studioCreativeAudioMode}
      onCreativeAudioModeChange={studio.setStudioCreativeAudioMode}
      creativeAssetKinds={studio.studioCreativeAssetKinds}
      onToggleCreativeAsset={studio.toggleStudioCreativeAsset}
      openAiKey={studio.studioOpenAiKey}
      onOpenAiKeyChange={studio.setStudioOpenAiKey}
      showAdvanced={studio.showStudioAdvanced}
      onToggleAdvanced={() => studio.setShowStudioAdvanced(prev => !prev)}
      sourceFiles={studio.creativeSourceFiles}
      onSourceFilesChange={studio.setCreativeSourceFiles}
      bgmFile={studio.creativeBgmFile}
      onBgmFileChange={studio.setCreativeBgmFile}
      isProducing={studio.isProducingCreative}
      creativeRender={studio.creativeRender}
      creativeRenderError={studio.creativeRenderError}
      studioView={studio.studioView}
      onProduce={studio.handleProduceCreative}
      onGoToResults={() => studio.setStudioView('results')}
      industryOptions={studio.studioIndustryOptions}
      selectedCreativeAssets={studio.selectedCreativeAssets}
    />
  );

  const studioContent = (
    <StudioContent
      studioView={studio.studioView}
      onSetStudioView={studio.setStudioView}
      studioSteps={studio.studioSteps}
      studioPlan={studio.studioPlan}
      studioCreativeFormat={studio.studioCreativeFormat}
      studioStatusLabel={studio.studioStatusLabel}
      sourceFilesCount={studio.creativeSourceFiles.length}
      advertiserName={studio.studioAdvertiserName}
      advertiserIndustry={studio.studioAdvertiserIndustry}
      copiedCreativeKey={studio.copiedCreativeKey}
      onCopyCreativeText={studio.copyCreativeText}
      studioPlanApiPayload={studio.studioPlanApiPayload}
      creativeProduceEndpoint={studio.creativeProduceEndpoint}
      creativeStatusEndpoint={studio.creativeStatusEndpoint}
      creativeRender={studio.creativeRender}
      onRefreshCreativeRender={studio.refreshCreativeRender}
      creativeHistory={studio.creativeHistory}
      creativeHistoryError={studio.creativeHistoryError}
      isLoadingCreativeHistory={studio.isLoadingCreativeHistory}
      onLoadCreativeHistory={studio.loadCreativeHistory}
      onApplyHistoryItem={studio.applyCreativeHistoryItem}
      onSetCreativeRender={studio.setCreativeRender}
    />
  );

  return (
    <div className="main-grid">
      <div className="sidebar">{studioSidebar}</div>
      <div>{studioContent}</div>
    </div>
  );
}
