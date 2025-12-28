import { createAdminClient } from '@/lib/supabase';
import type { 
  LMSPackage, 
  PackageWithTopics,
  LMSStudentPackage,
  StudentPackageWithDetails,
  CreatePackageRequest, 
  UpdatePackageRequest,
  AssignPackageRequest,
  LMSResult 
} from '@/types/lms';

/**
 * Create a new package
 */
export async function createPackage(data: CreatePackageRequest): Promise<LMSResult<LMSPackage>> {
  try {
    const supabase = createAdminClient();
    
    // Get max display_order
    const { data: maxOrder } = await supabase
      .from('lms_packages')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();
    
    const newOrder = (maxOrder?.display_order ?? -1) + 1;
    
    const { data: pkg, error } = await supabase
      .from('lms_packages')
      .insert({
        name: data.name,
        description: data.description || null,
        price: data.price || 0,
        duration_days: data.duration_days,
        display_order: newOrder,
        is_active: true,
      })
      .select()
      .single();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    // Add topics if provided
    if (data.topic_ids && data.topic_ids.length > 0) {
      const topicInserts = data.topic_ids.map(topic_id => ({
        package_id: pkg.id,
        topic_id,
      }));
      
      await supabase.from('lms_package_topics').insert(topicInserts);
    }
    
    return { success: true, data: pkg as LMSPackage };
  } catch (err) {
    return { success: false, error: 'Failed to create package' };
  }
}


/**
 * Update a package
 */
export async function updatePackage(id: string, data: UpdatePackageRequest): Promise<LMSResult<LMSPackage>> {
  try {
    const supabase = createAdminClient();
    
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.duration_days !== undefined) updateData.duration_days = data.duration_days;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.display_order !== undefined) updateData.display_order = data.display_order;
    
    const { data: pkg, error } = await supabase
      .from('lms_packages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    // Update topics if provided
    if (data.topic_ids !== undefined) {
      // Remove existing topics
      await supabase.from('lms_package_topics').delete().eq('package_id', id);
      
      // Add new topics
      if (data.topic_ids.length > 0) {
        const topicInserts = data.topic_ids.map(topic_id => ({
          package_id: id,
          topic_id,
        }));
        await supabase.from('lms_package_topics').insert(topicInserts);
      }
    }
    
    return { success: true, data: pkg as LMSPackage };
  } catch (err) {
    return { success: false, error: 'Failed to update package' };
  }
}

/**
 * Delete a package
 */
export async function deletePackage(id: string): Promise<LMSResult<void>> {
  try {
    const supabase = createAdminClient();
    
    const { error } = await supabase
      .from('lms_packages')
      .delete()
      .eq('id', id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to delete package' };
  }
}

/**
 * Get all packages with their topics
 */
export async function getAllPackagesWithTopics(): Promise<PackageWithTopics[]> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_packages')
      .select(`
        *,
        package_topics:lms_package_topics (
          topic:lms_topics (id, name, description, is_free, display_order)
        )
      `)
      .order('display_order', { ascending: true });
    
    if (error || !data) {
      return [];
    }
    
    return data.map((pkg: any) => ({
      ...pkg,
      topics: (pkg.package_topics || []).map((pt: any) => pt.topic).filter(Boolean),
    }));
  } catch (err) {
    return [];
  }
}


/**
 * Get a package by ID with topics
 */
export async function getPackageById(id: string): Promise<PackageWithTopics | null> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_packages')
      .select(`
        *,
        package_topics:lms_package_topics (
          topic:lms_topics (id, name, description, is_free, display_order)
        )
      `)
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      ...data,
      topics: (data.package_topics || []).map((pt: any) => pt.topic).filter(Boolean),
    };
  } catch (err) {
    return null;
  }
}

/**
 * Assign a package to a student
 */
export async function assignPackageToStudent(data: AssignPackageRequest): Promise<LMSResult<LMSStudentPackage>> {
  try {
    const supabase = createAdminClient();
    
    // Get package to get default duration
    const { data: pkg } = await supabase
      .from('lms_packages')
      .select('duration_days')
      .eq('id', data.package_id)
      .single();
    
    if (!pkg) {
      return { success: false, error: 'Package not found' };
    }
    
    const durationDays = data.duration_days || pkg.duration_days;
    const startsAt = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);
    
    const { data: studentPkg, error } = await supabase
      .from('lms_student_packages')
      .insert({
        student_id: data.student_id,
        package_id: data.package_id,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Student already has this package' };
      }
      return { success: false, error: error.message };
    }
    
    return { success: true, data: studentPkg as LMSStudentPackage };
  } catch (err) {
    return { success: false, error: 'Failed to assign package' };
  }
}

/**
 * Extend a student's package subscription
 */
export async function extendStudentPackage(id: string, additionalDays: number): Promise<LMSResult<LMSStudentPackage>> {
  try {
    const supabase = createAdminClient();
    
    // Get current subscription
    const { data: current } = await supabase
      .from('lms_student_packages')
      .select('expires_at')
      .eq('id', id)
      .single();
    
    if (!current) {
      return { success: false, error: 'Subscription not found' };
    }
    
    // Calculate new expiry (from current expiry or now, whichever is later)
    const baseDate = new Date(current.expires_at) > new Date() 
      ? new Date(current.expires_at) 
      : new Date();
    baseDate.setDate(baseDate.getDate() + additionalDays);
    
    const { data: updated, error } = await supabase
      .from('lms_student_packages')
      .update({ expires_at: baseDate.toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, data: updated as LMSStudentPackage };
  } catch (err) {
    return { success: false, error: 'Failed to extend subscription' };
  }
}

/**
 * Get all student package subscriptions
 */
export async function getAllStudentPackages(): Promise<StudentPackageWithDetails[]> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_student_packages')
      .select(`
        *,
        package:lms_packages (*),
        student:lms_students (id, username, email, phone, class)
      `)
      .order('created_at', { ascending: false });
    
    if (error || !data) {
      return [];
    }
    
    const now = new Date();
    return data.map((sp: any) => ({
      ...sp,
      is_active: new Date(sp.expires_at) > now,
    }));
  } catch (err) {
    return [];
  }
}

/**
 * Get packages for a student
 */
export async function getStudentPackages(studentId: string): Promise<StudentPackageWithDetails[]> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_student_packages')
      .select(`
        *,
        package:lms_packages (*)
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    
    if (error || !data) {
      return [];
    }
    
    const now = new Date();
    return data.map((sp: any) => ({
      ...sp,
      is_active: new Date(sp.expires_at) > now,
    }));
  } catch (err) {
    return [];
  }
}

/**
 * Check if student has access to a topic (free or via package)
 */
export async function hasTopicAccess(studentId: string, topicId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    
    // Check if topic is free
    const { data: topic } = await supabase
      .from('lms_topics')
      .select('is_free')
      .eq('id', topicId)
      .single();
    
    if (topic?.is_free) {
      return true;
    }
    
    // Check if student has active package with this topic
    const { data: access } = await supabase
      .from('lms_student_packages')
      .select(`
        id,
        expires_at,
        package:lms_packages!inner (
          package_topics:lms_package_topics!inner (topic_id)
        )
      `)
      .eq('student_id', studentId)
      .gt('expires_at', new Date().toISOString());
    
    if (!access || access.length === 0) {
      return false;
    }
    
    // Check if any package contains this topic
    return access.some((sp: any) => 
      sp.package?.package_topics?.some((pt: any) => pt.topic_id === topicId)
    );
  } catch (err) {
    return false;
  }
}

/**
 * Get topics accessible by a student (free + from packages)
 */
export async function getAccessibleTopics(studentId: string): Promise<string[]> {
  try {
    const supabase = createAdminClient();
    
    // Get free topics
    const { data: freeTopics } = await supabase
      .from('lms_topics')
      .select('id')
      .eq('is_free', true);
    
    const freeTopicIds = (freeTopics || []).map((t: any) => t.id);
    
    // Get topics from active packages
    const { data: packageTopics } = await supabase
      .from('lms_student_packages')
      .select(`
        package:lms_packages (
          package_topics:lms_package_topics (topic_id)
        )
      `)
      .eq('student_id', studentId)
      .gt('expires_at', new Date().toISOString());
    
    const packageTopicIds = (packageTopics || [])
      .flatMap((sp: any) => sp.package?.package_topics || [])
      .map((pt: any) => pt.topic_id);
    
    // Combine and dedupe
    return [...new Set([...freeTopicIds, ...packageTopicIds])];
  } catch (err) {
    return [];
  }
}
