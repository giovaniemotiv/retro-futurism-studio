import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    //console.log('📥 Received request to generate-sora-video');
    
    if (!openAIApiKey) {
      console.error('❌ OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key is not configured. Please add your OPENAI_API_KEY in the backend settings.' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { metadata } = await req.json();

    if (!metadata || !Array.isArray(metadata) || metadata.length === 0) {
      console.error('❌ No metadata provided');
      return new Response(
        JSON.stringify({ error: 'Metadata tags are required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    //console.log('🎬 Generating Sora video with metadata:', metadata);

    // Create a cinematic prompt from the metadata tags
    const prompt = `Create a cinematic, futuristic video that seamlessly blends the following themes: ${metadata.join(', ')}. The video should have a retro-futuristic aesthetic with clean, minimalist visuals. Include smooth transitions, ambient lighting, and a sense of hope for a sustainable future. Style: cinematic, 4K, professional color grading.`;

    //console.log('📝 Sora prompt:', prompt);

    // Step 1: Start video generation job
    const createResponse = await fetch('https://api.openai.com/v1/videos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sora-2-pro',
        prompt: prompt,
        size: '1280x720',
        seconds: '8',
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('❌ Sora API create error:', createResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: `Sora API error: ${createResponse.status}`, 
          details: errorText,
          message: 'Failed to start video generation. Please check your OpenAI API key has Sora access enabled.'
        }), 
        { status: createResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const createData = await createResponse.json();
    const videoId = createData.id;
    //console.log('🎥 Video job started with ID:', videoId);

    // Step 2: Poll for completion (with timeout)
    const maxAttempts = 60; // 5 minutes max (5 second intervals)
    let attempts = 0;
    let videoUrl = null;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;

      const statusResponse = await fetch(`https://api.openai.com/v1/videos/${videoId}`, {
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
        },
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error('❌ Status check error:', statusResponse.status, errorText);
        continue;
      }

      const statusData = await statusResponse.json();
      //console.log(`📊 Status check ${attempts}/${maxAttempts}:`, statusData.status);

      if (statusData.status === 'completed') {
        // Step 3: Fetch the video content
        const contentResponse = await fetch(`https://api.openai.com/v1/videos/${videoId}/content`, {
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
          },
        });

        if (!contentResponse.ok) {
          console.error('❌ Failed to fetch video content');
          throw new Error('Failed to fetch video content');
        }

        // Get video as blob and convert to base64
        const videoBlob = await contentResponse.blob();
        const arrayBuffer = await videoBlob.arrayBuffer();
        
        // Convert to base64 in chunks to avoid stack overflow
        const uint8Array = new Uint8Array(arrayBuffer);
        let base64 = '';
        const chunkSize = 0x8000; // Process 32KB at a time
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.subarray(i, i + chunkSize);
          base64 += String.fromCharCode.apply(null, Array.from(chunk));
        }
        
        videoUrl = `data:video/mp4;base64,${btoa(base64)}`;
        
        //console.log('✅ Video generation completed and fetched');
        break;
      } else if (statusData.status === 'failed' || statusData.status === 'cancelled') {
        console.error('❌ Video generation failed:', statusData);
        return new Response(
          JSON.stringify({ 
            error: 'Video generation failed', 
            details: statusData 
          }), 
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!videoUrl) {
      console.error('❌ Video generation timed out');
      return new Response(
        JSON.stringify({ 
          error: 'Video generation timed out', 
          message: 'The video is taking longer than expected. Please try again.'
        }), 
        { status: 408, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        videoUrl: videoUrl,
        videoId: videoId,
        metadata: metadata 
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in generate-sora-video function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'An unexpected error occurred during video generation.'
      }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
